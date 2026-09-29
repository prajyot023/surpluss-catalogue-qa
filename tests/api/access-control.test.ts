import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// auth() returns whichever user the test picked with signInAs()/signOutUser().
vi.mock("@/auth", () => import("../helpers/auth-mock"));
// revalidatePath() needs a real Next.js request; it has no effect on what we check.
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { deleteCatalogue, setCatalogueStatus } from "@/app/admin/actions";
import { createCatalogueWithProducts, updateCatalogueBanners } from "@/app/admin/catalogues/actions";
import { saveLeadNotes, updateLeadStatus } from "@/app/admin/leads/actions";
import { archiveProducts, createProduct, updateProductPrices } from "@/app/admin/products/actions";
import { importProducts } from "@/app/admin/products/import-actions";
import { GET as getBadgePresets, POST as createBadgePreset } from "@/app/api/admin/badge-presets/route";
import { GET as getCatalogue, PATCH as patchCatalogue } from "@/app/api/admin/catalogues/[id]/route";
import { POST as addListings } from "@/app/api/admin/catalogues/[id]/listings/route";
import { DELETE as deleteListing, PATCH as patchListing } from "@/app/api/admin/catalogues/[id]/listings/[listingId]/route";
import { PUT as reorderListings } from "@/app/api/admin/catalogues/[id]/listings/order/route";
import { GET as slugCheck } from "@/app/api/admin/catalogues/slug-check/route";
import { GET as getCategories } from "@/app/api/admin/categories/route";
import { GET as searchProducts } from "@/app/api/admin/products/search/route";
import { GET as globalSearch } from "@/app/api/admin/search/route";
import { POST as presignUpload } from "@/app/api/uploads/presign/route";
import { signInAs, signOutUser } from "../helpers/auth-mock";
import { createCatalogue, jsonRequest, prisma, removeCatalogues, routeContext, TEST_TAG } from "../helpers/fixtures";

// Who may do what, checked on the server. The README's rule: staff build
// catalogues, manage products and work leads; only admin may PUBLISH or DELETE
// a catalogue. The UI hides those two buttons from staff, so these tests call
// the server directly, the way a curious staff member with dev tools could.

const created: string[] = [];
afterAll(() => removeCatalogues(created));
afterEach(() => signOutUser());

async function freshCatalogue(options?: Parameters<typeof createCatalogue>[0]) {
  const catalogue = await createCatalogue(options);
  created.push(catalogue.id);
  return catalogue;
}

/** The full body the catalogue edit form sends, with status overridden. */
function editBody(catalogue: { name: string; slug: string }, overrides: Record<string, unknown> = {}) {
  return {
    name: catalogue.name,
    slug: catalogue.slug,
    description: "",
    category: "",
    notifyNumber: "",
    status: "draft",
    validUntil: null,
    banners: [],
    ...overrides,
  };
}

async function statusOf(catalogueId: string) {
  return (await prisma().catalogue.findUnique({ where: { id: catalogueId }, select: { status: true } }))?.status;
}

// ---------------------------------------------------------------------------
describe("signed out: every admin API and server action refuses", () => {
  beforeEach(() => signOutUser());

  const ANY_ID = "11111111-1111-4111-8111-111111111111";
  const idCtx = routeContext({ id: ANY_ID });
  const listingCtx = routeContext({ id: ANY_ID, listingId: ANY_ID });

  it.each([
    ["GET  /api/admin/catalogues/[id]", () => getCatalogue(jsonRequest(`/api/admin/catalogues/${ANY_ID}`, "GET"), idCtx)],
    ["PATCH /api/admin/catalogues/[id]", () => patchCatalogue(jsonRequest(`/api/admin/catalogues/${ANY_ID}`, "PATCH", {}), idCtx)],
    ["POST /api/admin/catalogues/[id]/listings", () => addListings(jsonRequest("/x", "POST", { productIds: [ANY_ID] }), idCtx)],
    ["PATCH listing", () => patchListing(jsonRequest("/x", "PATCH", { isVisible: false }), listingCtx)],
    ["DELETE listing", () => deleteListing(jsonRequest("/x", "DELETE"), listingCtx)],
    ["PUT listing order", () => reorderListings(jsonRequest("/x", "PUT", { orderedIds: [ANY_ID] }), idCtx)],
    ["GET  /api/admin/products/search", () => searchProducts(jsonRequest("/api/admin/products/search", "GET"))],
    ["GET  /api/admin/search", () => globalSearch(jsonRequest("/api/admin/search?q=a", "GET"))],
    ["GET  /api/admin/categories", () => getCategories(jsonRequest("/api/admin/categories", "GET"))],
    ["GET  /api/admin/catalogues/slug-check", () => slugCheck(jsonRequest("/api/admin/catalogues/slug-check?slug=a", "GET"))],
    ["GET  /api/admin/badge-presets", () => getBadgePresets()],
    ["POST /api/admin/badge-presets", () => createBadgePreset(jsonRequest("/x", "POST", { text: "x", bg: "#000000", fg: "white" }))],
    ["POST /api/uploads/presign", () => presignUpload(jsonRequest("/x", "POST", { fileName: "a.png", contentType: "image/png" }))],
  ])("%s -> 401", async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(401);
  });

  it.each([
    ["setCatalogueStatus", () => setCatalogueStatus(ANY_ID, "published")],
    ["deleteCatalogue", () => deleteCatalogue(ANY_ID)],
    ["createCatalogueWithProducts", () => createCatalogueWithProducts({ name: "x", slug: "x", description: "", category: "", validUntil: null, banners: [], publish: true, productIds: [] })],
    ["updateCatalogueBanners", () => updateCatalogueBanners(ANY_ID, [])],
    ["updateLeadStatus", () => updateLeadStatus("ENQ-1", "won")],
    ["saveLeadNotes", () => saveLeadNotes("ENQ-1", "x")],
    ["createProduct", () => createProduct({ sku: "x", name: "xx", offerPrice: 1 })],
    ["updateProductPrices", () => updateProductPrices([{ id: ANY_ID, mrp: 1, offerPrice: 1 }])],
    ["archiveProducts", () => archiveProducts([ANY_ID])],
    ["importProducts", () => importProducts({ fileName: "a.csv", columnMapping: {}, updateExisting: true, rows: [{ sku: "x", name: "x", quantity: 1 }] })],
  ])("server action %s -> 'sign in again'", async (_label, call) => {
    expect(await call()).toEqual({ error: "You need to sign in again." });
  });
});

// ---------------------------------------------------------------------------
describe("publishing a catalogue: admin only", () => {
  it("admin can publish a complete draft through the edit API (proves the endpoint works)", async () => {
    signInAs("admin");
    const catalogue = await freshCatalogue({ status: "draft" });

    const response = await patchCatalogue(
      jsonRequest(`/api/admin/catalogues/${catalogue.id}`, "PATCH", editBody(catalogue, { status: "published" })),
      routeContext({ id: catalogue.id }),
    );

    expect(response.status).toBe(200);
    expect(await statusOf(catalogue.id)).toBe("published");
  });

  it("staff are refused by the publish action the UI uses", async () => {
    signInAs("staff");
    const catalogue = await freshCatalogue({ status: "draft" });

    expect(await setCatalogueStatus(catalogue.id, "published")).toEqual({ error: "Only an admin can change what is published." });
    expect(await statusOf(catalogue.id)).toBe("draft");
  });

  // SECURITY BUG: fails today. Same outcome as above, different door: the
  // catalogue edit API has no role check, so staff can publish by sending
  // status "published" in the edit form's request.
  it("staff cannot publish through the catalogue edit API either", async () => {
    signInAs("staff");
    const catalogue = await freshCatalogue({ status: "draft" });

    const response = await patchCatalogue(
      jsonRequest(`/api/admin/catalogues/${catalogue.id}`, "PATCH", editBody(catalogue, { status: "published" })),
      routeContext({ id: catalogue.id }),
    );

    expect(response.status).toBe(403);
    expect(await statusOf(catalogue.id)).toBe("draft");
  });

  it("staff can still edit a draft's details through the same API (the fix must not block normal work)", async () => {
    signInAs("staff");
    const catalogue = await freshCatalogue({ status: "draft" });

    const response = await patchCatalogue(
      jsonRequest(`/api/admin/catalogues/${catalogue.id}`, "PATCH", editBody(catalogue, { description: "Updated by staff" })),
      routeContext({ id: catalogue.id }),
    );

    expect(response.status).toBe(200);
    expect(await statusOf(catalogue.id)).toBe("draft");
  });

  // SECURITY BUG: fails today. "Create catalogue" takes publish: true from
  // anyone signed in, so staff can create a catalogue that is live at once.
  it("staff cannot create a catalogue that is published straight away", async () => {
    signInAs("staff");
    const slug = `${TEST_TAG}-staff-publish-${Date.now()}`;
    const product = await prisma().product.findUniqueOrThrow({ where: { sku: "TRV-1024" } });

    const result = await createCatalogueWithProducts({
      name: "Staff shortcut",
      slug,
      description: "",
      category: "",
      validUntil: null,
      banners: [],
      publish: true,
      productIds: [product.id],
    });
    const saved = await prisma().catalogue.findUnique({ where: { slug } });
    if (saved) created.push(saved.id);

    expect(result).toHaveProperty("error");
    expect(saved?.status).not.toBe("published");
  });
});

// ---------------------------------------------------------------------------
describe("deleting a catalogue: admin only", () => {
  it("admin can delete a catalogue that has no leads (proves the action works)", async () => {
    signInAs("admin");
    const catalogue = await freshCatalogue();

    expect(await deleteCatalogue(catalogue.id)).toMatchObject({ ok: true });
    expect(await statusOf(catalogue.id)).toBeUndefined();
  });

  // SECURITY BUG: fails today. deleteCatalogue checks that someone is signed
  // in but never checks the role, unlike setCatalogueStatus right above it.
  it("staff cannot delete a catalogue", async () => {
    signInAs("staff");
    const catalogue = await freshCatalogue();

    const result = await deleteCatalogue(catalogue.id);

    expect(result).toHaveProperty("error");
    expect(await statusOf(catalogue.id)).toBe("draft");
  });
});

// ---------------------------------------------------------------------------
describe("IDs from another catalogue in the URL", () => {
  // Catalogue A's URL, catalogue B's listing id. Staff are signed in, which is
  // enough to reach these endpoints; the point is which catalogue gets changed.
  async function twoCatalogues() {
    signInAs("staff");
    const a = await freshCatalogue({ skus: ["TRV-1024"] });
    const b = await freshCatalogue({ status: "published", skus: ["AUD-0842"] });
    return { a, b, bListing: b.listings[0] };
  }

  // BUG: fails today. The update is filtered on the listing id only, not on
  // the catalogue in the URL, so B's product is hidden from B's live page.
  it("PATCH /catalogues/A/listings/<B's listing> does not touch catalogue B", async () => {
    const { a, bListing } = await twoCatalogues();

    const response = await patchListing(
      jsonRequest(`/api/admin/catalogues/${a.id}/listings/${bListing.id}`, "PATCH", { isVisible: false }),
      routeContext({ id: a.id, listingId: bListing.id }),
    );

    expect(response.status).toBe(404);
    const after = await prisma().catalogueListing.findUnique({ where: { id: bListing.id } });
    expect(after?.isVisible).toBe(true);
  });

  // BUG: fails today, same cause: B loses a product via A's URL.
  it("DELETE /catalogues/A/listings/<B's listing> does not remove it from catalogue B", async () => {
    const { a, bListing } = await twoCatalogues();

    const response = await deleteListing(
      jsonRequest(`/api/admin/catalogues/${a.id}/listings/${bListing.id}`, "DELETE"),
      routeContext({ id: a.id, listingId: bListing.id }),
    );

    expect(response.status).toBe(404);
    expect(await prisma().catalogueListing.findUnique({ where: { id: bListing.id } })).not.toBeNull();
  });

  it("PUT /catalogues/A/listings/order with B's listing ids is refused (this route does check)", async () => {
    const { a, bListing } = await twoCatalogues();

    const response = await reorderListings(
      jsonRequest(`/api/admin/catalogues/${a.id}/listings/order`, "PUT", { orderedIds: [bListing.id] }),
      routeContext({ id: a.id }),
    );

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe("valid id, tampered payload", () => {
  it.each([
    ["a status the edit form never sends ('expired')", { status: "expired" }],
    ["a slug with path characters", { slug: "../admin" }],
    ["a banner image on plain http", { banners: [{ imageUrl: "http://evil.test/a.png", filter: null }] }],
    ["four banners (max is three)", { banners: Array(4).fill({ imageUrl: "https://img.test/a.png", filter: null }) }],
  ])("PATCH catalogue with %s -> 400 and nothing saved", async (_label, overrides) => {
    signInAs("admin");
    const catalogue = await freshCatalogue();

    const response = await patchCatalogue(
      jsonRequest(`/api/admin/catalogues/${catalogue.id}`, "PATCH", editBody(catalogue, overrides)),
      routeContext({ id: catalogue.id }),
    );

    expect(response.status).toBe(400);
    const after = await prisma().catalogue.findUniqueOrThrow({ where: { id: catalogue.id } });
    expect(after.slug).toBe(catalogue.slug);
    expect(after.status).toBe("draft");
  });

  it("PATCH listing with isVisible as the string 'false' -> 400", async () => {
    signInAs("staff");
    const catalogue = await freshCatalogue();
    const listing = catalogue.listings[0];

    const response = await patchListing(
      jsonRequest(`/api/admin/catalogues/${catalogue.id}/listings/${listing.id}`, "PATCH", { isVisible: "false" }),
      routeContext({ id: catalogue.id, listingId: listing.id }),
    );

    expect(response.status).toBe(400);
  });

  it("publishing is blocked while a listed product has no offer price (409 with the product named)", async () => {
    signInAs("admin");
    const sku = `${TEST_TAG}-noprice-${Date.now()}`;
    await prisma().product.create({ data: { sku, name: "No price yet", mrp: "100.00", offerPrice: null, quantity: 10 } });
    // Made directly (not freshCatalogue) so it can be removed before the product it lists.
    const catalogue = await createCatalogue({ skus: [sku] });
    try {
      const response = await patchCatalogue(
        jsonRequest(`/api/admin/catalogues/${catalogue.id}`, "PATCH", editBody(catalogue, { status: "published" })),
        routeContext({ id: catalogue.id }),
      );

      expect(response.status).toBe(409);
      expect((await response.json()).incompleteProducts).toEqual([expect.objectContaining({ sku })]);
      expect(await statusOf(catalogue.id)).toBe("draft");
    } finally {
      await removeCatalogues([catalogue.id]);
      await prisma().product.delete({ where: { sku } });
    }
  });
});
