import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import {
  PRODUCT_SEARCH_PAGE_SIZE,
  type ProductSearchPage,
  type ProductSearchResult,
} from "@/lib/schemas/listing";

const querySchema = z.object({
  query: z.string().trim().max(120).default(""),
  catalogueId: z.uuid().optional(),
  /** Id of the last product from the previous page; omitted for the first page. */
  cursor: z.uuid().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    query: searchParams.get("query") ?? "",
    catalogueId: searchParams.get("catalogueId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid search." }, { status: 400 });

  const { query, catalogueId, cursor } = parsed.data;
  const prisma = getPrisma();
  // Keyset pagination: rows are ordered by (name, id) so the cursor is stable
  // even when products are added or renamed while the user scrolls. One extra
  // row is fetched to learn whether another page exists without a count query.
  const rows = await prisma.product.findMany({
    // Archived products are retired and can't be added to catalogues.
    where: {
      archivedAt: null,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { brand: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: PRODUCT_SEARCH_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      sku: true,
      name: true,
      brand: true,
      category: true,
      imageUrls: true,
      mrp: true,
      offerPrice: true,
      priceOnRequest: true,
      quantity: true,
    },
  });

  const hasMore = rows.length > PRODUCT_SEARCH_PAGE_SIZE;
  const products = hasMore ? rows.slice(0, PRODUCT_SEARCH_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? products[products.length - 1].id : null;

  const listedIds =
    catalogueId && products.length
      ? new Set(
          (
            await prisma.catalogueListing.findMany({
              where: { catalogueId, productId: { in: products.map(({ id }) => id) } },
              select: { productId: true },
            })
          ).map(({ productId }) => productId),
        )
      : new Set<string>();

  const results: ProductSearchResult[] = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    image: product.imageUrls[0] ?? null,
    mrp: product.mrp !== null ? Number(product.mrp) : null,
    offerPrice: product.offerPrice !== null ? Number(product.offerPrice) : null,
    priceOnRequest: product.priceOnRequest,
    quantity: product.quantity,
    alreadyListed: listedIds.has(product.id),
  }));

  const page: ProductSearchPage = { products: results, nextCursor };
  return NextResponse.json(page);
}
