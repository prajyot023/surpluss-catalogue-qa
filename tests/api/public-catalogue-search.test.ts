import { describe, expect, it } from "vitest";
import { GET as searchCatalogue } from "@/app/api/catalogues/[slug]/search/route";
import { routeContext } from "../helpers/fixtures";

// The public search box on a catalogue page. No login is needed, so whatever
// this returns, anyone on the internet can read. It uses the seeded catalogues
// and only reads, so it never changes data.

function search(slug: string, q: string) {
  const request = new Request(`http://localhost:3001/api/catalogues/${slug}/search?q=${encodeURIComponent(q)}`);
  return searchCatalogue(request, routeContext({ slug }));
}

describe("GET /api/catalogues/[slug]/search (public, signed out)", () => {
  it("finds products in a published, live catalogue", async () => {
    const response = await search("premium-corporate-essentials", "trolley");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.matches).toEqual([expect.objectContaining({ sku: "TRV-1024" })]);
  });

  it("returns 404 for a catalogue that does not exist", async () => {
    const response = await search("no-such-catalogue", "a");
    expect(response.status).toBe(404);
  });

  // SECURITY BUG: fails today. The catalogue page itself returns 404 for this
  // draft, but the search behind it returns names, SKUs and the confidential
  // Northstar offer prices to anyone who knows or guesses the slug.
  it("does not reveal anything from a draft catalogue", async () => {
    const response = await search("festive-overstock-2026", "a");
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body).not.toHaveProperty("matches");
  });

  // BUG: fails today. The validity date of this catalogue has passed, so its
  // prices are stale. The page shows a "closed" screen, but search still
  // returns the old offer prices.
  it("does not return prices from a catalogue whose validity date has passed", async () => {
    const response = await search("monsoon-clearance-2026", "a");
    const body = await response.json();
    expect(body.matches ?? []).toEqual([]);
  });
});
