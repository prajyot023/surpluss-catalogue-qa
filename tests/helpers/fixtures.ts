// Test data that each test creates for itself and removes afterwards, so tests
// never change the seeded catalogues and can run in parallel without clashing.

import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/prisma";

export const prisma = () => getPrisma();

/** Every row a test creates carries this in its slug / buyer name. */
export const TEST_TAG = "vitest";

type CatalogueOptions = {
  status?: "draft" | "published";
  expiresAt?: Date | null;
  /** SKUs from the seed data to list in this catalogue. */
  skus?: string[];
};

export async function createCatalogue({ status = "draft", expiresAt = null, skus = ["TRV-1024"] }: CatalogueOptions = {}) {
  const db = prisma();
  const slug = `${TEST_TAG}-${randomUUID()}`;
  const products = await db.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } });
  if (products.length !== skus.length) throw new Error(`Seed data is missing one of ${skus.join(", ")}. Run npm run db:seed.`);

  const catalogue = await db.catalogue.create({
    data: {
      slug,
      name: `Test catalogue ${slug}`,
      status,
      expiresAt,
      publishedAt: status === "published" ? new Date() : null,
      listings: {
        create: skus.map((sku, index) => ({
          productId: products.find((product) => product.sku === sku)!.id,
          displayOrder: index,
        })),
      },
    },
    include: { listings: { include: { product: true }, orderBy: { displayOrder: "asc" } } },
  });
  return catalogue;
}

export async function removeCatalogues(ids: string[]) {
  if (!ids.length) return;
  const db = prisma();
  await db.enquiry.deleteMany({ where: { catalogueId: { in: ids } } });
  await db.catalogue.deleteMany({ where: { id: { in: ids } } });
}

export async function findCatalogueBySlug(slug: string) {
  const catalogue = await prisma().catalogue.findUnique({ where: { slug } });
  if (!catalogue) throw new Error(`Seeded catalogue "${slug}" is missing. Run npm run db:seed.`);
  return catalogue;
}

/** Route handlers take (request, { params: Promise<...> }). */
export function routeContext<T>(params: T) {
  return { params: Promise.resolve(params) };
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost:3001${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
