import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// after() only works inside a real Next.js request; here it is a no-op, so no
// WhatsApp/email notification is attempted.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: () => {} }));

import { POST as submitEnquiry } from "@/app/api/enquiries/route";
import { createCatalogue, jsonRequest, prisma, removeCatalogues, TEST_TAG } from "../helpers/fixtures";

// POST /api/enquiries is the only public write in the product: a buyer, not
// signed in, sends contact details and quantities. Every accepted enquiry
// becomes a lead the sales team acts on.
//
// Seeded product used throughout: TRV-1024, offer price 2499, stock 240, MOQ 20.

const created: string[] = [];
let live: Awaited<ReturnType<typeof createCatalogue>>;
let other: Awaited<ReturnType<typeof createCatalogue>>;

beforeAll(async () => {
  live = await createCatalogue({ status: "published", skus: ["TRV-1024"] });
  other = await createCatalogue({ status: "published", skus: ["AUD-0842"] });
  created.push(live.id, other.id);
});

afterAll(() => removeCatalogues(created));
afterEach(() => vi.restoreAllMocks());

function enquiry(overrides: Record<string, unknown> = {}) {
  return {
    catalogueId: live.id,
    name: `${TEST_TAG} buyer`,
    company: "Acme Traders",
    countryCode: "+91",
    phone: "9876543210",
    email: "",
    items: [{ productId: live.listings[0].productId, quantity: 50 }],
    ...overrides,
  };
}

const send = (body: unknown) => submitEnquiry(jsonRequest("/api/enquiries", "POST", body));

describe("POST /api/enquiries — valid requests", () => {
  it("saves the lead with a price snapshot taken at the moment of the enquiry", async () => {
    const response = await send(enquiry());
    expect(response.status).toBe(201);
    const { reference } = await response.json();
    expect(reference).toMatch(/^ENQ-\d+$/);

    const saved = await prisma().enquiry.findUnique({ where: { reference }, include: { items: true } });
    expect(saved).toMatchObject({ catalogueId: live.id, buyerName: `${TEST_TAG} buyer`, phone: "9876543210", status: "new" });
    expect(saved!.items).toHaveLength(1);
    expect(saved!.items[0]).toMatchObject({ productSku: "TRV-1024", requestedQuantity: 50 });
    expect(Number(saved!.items[0].unitPrice)).toBe(2499);
  });
});

describe("POST /api/enquiries — rejected input", () => {
  it.each([
    ["no phone and no email", { phone: "", email: "" }],
    ["a quantity of zero", { items: [{ productId: "PRODUCT", quantity: 0 }] }],
    ["a fractional quantity", { items: [{ productId: "PRODUCT", quantity: 25.5 }] }],
    ["an empty item list", { items: [] }],
    ["a catalogue id that is not a uuid", { catalogueId: "1 OR 1=1" }],
  ])("returns 400 for %s", async (_label, overrides) => {
    const body = enquiry(overrides);
    body.items = (body.items as { productId: string; quantity: number }[]).map((item) => ({
      ...item,
      productId: item.productId === "PRODUCT" ? live.listings[0].productId : item.productId,
    }));
    const response = await send(body);
    expect(response.status).toBe(400);
  });

  it("refuses a quantity below the product's MOQ (20)", async () => {
    const response = await send(enquiry({ items: [{ productId: live.listings[0].productId, quantity: 19 }] }));
    expect(response.status).toBe(400);
  });

  it("refuses a quantity above the available stock (240)", async () => {
    const response = await send(enquiry({ items: [{ productId: live.listings[0].productId, quantity: 241 }] }));
    expect(response.status).toBe(400);
  });

  it("refuses a product that belongs to a different catalogue (tampered product id)", async () => {
    const response = await send(enquiry({ items: [{ productId: other.listings[0].productId, quantity: 50 }] }));
    expect(response.status).toBe(409);
  });
});

describe("POST /api/enquiries — catalogue lifecycle", () => {
  async function leadsFor(catalogueId: string) {
    return prisma().enquiry.count({ where: { catalogueId } });
  }

  // BUG: fails today. The route never checks the catalogue's status, so a
  // lead can be created against a draft that buyers should never have seen.
  it("refuses an enquiry against a draft catalogue", async () => {
    const draft = await createCatalogue({ status: "draft", skus: ["TRV-1024"] });
    created.push(draft.id);

    const response = await send(enquiry({ catalogueId: draft.id, items: [{ productId: draft.listings[0].productId, quantity: 50 }] }));

    expect(response.status).not.toBe(201);
    expect(await leadsFor(draft.id)).toBe(0);
  });

  // BUG: fails today. The validity date has passed, so the price is stale,
  // yet the lead is saved with today's price as if the offer still stood.
  it("refuses an enquiry against a catalogue whose validity date has passed", async () => {
    const expired = await createCatalogue({
      status: "published",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      skus: ["TRV-1024"],
    });
    created.push(expired.id);

    const response = await send(
      enquiry({ catalogueId: expired.id, items: [{ productId: expired.listings[0].productId, quantity: 50 }] }),
    );

    expect(response.status).not.toBe(201);
    expect(await leadsFor(expired.id)).toBe(0);
  });
});

describe("POST /api/enquiries — reference numbers", () => {
  // BUG: fails today. The reference is the last 7 digits of Date.now(), so two
  // buyers submitting in the same millisecond get the same reference, and the
  // unique index turns the second one into a 500: that lead is lost.
  // Date.now is pinned so the collision happens every run, not by luck.
  it("saves two enquiries sent in the same millisecond as two separate leads", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_790_000_000_000);

    const first = await send(enquiry({ name: `${TEST_TAG} buyer one` }));
    const second = await send(enquiry({ name: `${TEST_TAG} buyer two` }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const [a, b] = [await first.json(), await second.json()];
    expect(a.reference).not.toBe(b.reference);
  });
});
