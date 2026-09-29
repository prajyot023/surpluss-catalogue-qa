import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

// One buyer journey, end to end:
//   published catalogue -> search -> product page -> enquiry with a quantity
//   -> submit -> admin signs in -> the lead is in the inbox with the right
//   buyer, product, quantity and price snapshot.
//
// Data: reads the seeded live catalogue (read-only) and creates exactly one
// enquiry, tagged with a unique buyer name, which afterEach deletes.
//
// Waiting: no fixed sleeps. Every wait is on something the user would see
// (a heading, a dialog, a row) or on the enquiry API response itself.

const CATALOGUE = { slug: "premium-corporate-essentials", title: "Premium corporate essentials" };
const PRODUCT = { name: "Atlas cabin trolley", sku: "TRV-1024", price: "2,499", moq: 20 };
const QUANTITY = 60;
const BUYER = `E2E Buyer ${Date.now()}`;
const PHONE = "9876500001";
const ADMIN = { email: "admin@catalogue.test", password: "Admin#2026" };

// The dev server compiles each route on first visit, which can take several
// seconds; a longer expect timeout covers that without any fixed sleep.
expect.configure({ timeout: 20_000 });
test.setTimeout(120_000);

let reference: string | undefined;

test.afterEach(async () => {
  if (!reference) return;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  // enquiry_items rows are removed by the ON DELETE CASCADE on the foreign key.
  await db.query("DELETE FROM enquiries WHERE reference = $1", [reference]);
  await db.end();
  reference = undefined;
});

test("a buyer's enquiry from the live catalogue reaches the admin leads inbox", async ({ page }) => {
  await test.step("buyer opens the published catalogue", async () => {
    await page.goto(`/catalogue/${CATALOGUE.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: CATALOGUE.title })).toBeVisible();
  });

  await test.step("buyer searches and opens a product", async () => {
    await page.getByRole("button", { name: "Search products" }).click();
    await page.getByRole("textbox", { name: "Search products" }).fill("trolley");
    const card = page.getByRole("heading", { level: 3, name: PRODUCT.name });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/catalogue/${CATALOGUE.slug}/product/`));
    await expect(page.getByRole("heading", { level: 1, name: PRODUCT.name })).toBeVisible();
  });

  await test.step("buyer fills the enquiry with a quantity above the MOQ and sends it", async () => {
    await page.getByRole("button", { name: "Contact Us" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Your name").fill(BUYER);
    await dialog.getByLabel("WhatsApp number").fill(PHONE);
    await dialog.getByLabel("Quantity in units").fill(String(QUANTITY));

    // Wait on the API call itself, so the test knows the server accepted the
    // enquiry (and which reference it got) rather than guessing from the UI.
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith("/api/enquiries") && res.request().method() === "POST"),
      dialog.getByRole("button", { name: "Send enquiry" }).click(),
    ]);
    expect(response.status()).toBe(201);
    reference = (await response.json()).reference;
    expect(reference).toMatch(/^ENQ-\d+$/);

    await expect(dialog.getByRole("heading", { name: "Enquiry sent" })).toBeVisible();
    await expect(dialog.getByText(reference!, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${QUANTITY} units`)).toBeVisible();
  });

  await test.step("admin signs in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin(\?|$)/);
  });

  await test.step("the lead is in the inbox under the buyer's name and reference", async () => {
    await page.goto("/admin/leads");
    await page.getByPlaceholder("Search buyer, reference or contact").fill(reference!);

    const row = page.getByRole("row").filter({ hasText: reference! });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("link", { name: BUYER })).toBeVisible();
    await expect(row).toContainText(CATALOGUE.title);
  });

  await test.step("the lead detail shows what the buyer asked for, at the price they saw", async () => {
    await page.getByRole("link", { name: BUYER }).click();
    await expect(page.getByRole("heading", { name: reference! })).toBeVisible();

    const main = page.getByRole("main");
    await expect(main.getByText(`${PRODUCT.name} ↗`)).toBeVisible();
    await expect(main.getByText(PRODUCT.sku)).toBeVisible();
    await expect(main.getByText(`${QUANTITY} units`, { exact: true })).toBeVisible();
    await expect(main.getByText(`₹${PRODUCT.price}`)).toBeVisible();
    await expect(main.getByText(`+91${PHONE}`)).toBeVisible();
    // The dropdown's text also includes its arrow icon ("New▼"), so match the start.
    await expect(main.getByRole("combobox", { name: "Status" })).toHaveText(/^New/);
  });
});
