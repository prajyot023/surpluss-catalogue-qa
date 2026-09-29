import { getPrisma } from "@/lib/prisma";
import type { IncompleteProduct } from "@/lib/schemas/product";

export const INCOMPLETE_PRODUCT_WHERE = {
  OR: [
    { priceOnRequest: false, mrp: null },
    { priceOnRequest: false, offerPrice: null },
    { quantity: { lte: 0 } },
  ],
};

/** Products in the catalogue that block publishing: missing MRP or offer price,
 * or without any stock. */
export async function findIncompleteProducts(catalogueId: string): Promise<IncompleteProduct[]> {
  const listings = await getPrisma().catalogueListing.findMany({
    where: {
      catalogueId,
      product: INCOMPLETE_PRODUCT_WHERE,
    },
    orderBy: { displayOrder: "asc" },
    select: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          mrp: true,
          offerPrice: true,
          priceOnRequest: true,
          quantity: true,
        },
      },
    },
  });
  return listings.map(({ product }) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    mrp: product.mrp !== null ? Number(product.mrp) : null,
    offerPrice: product.offerPrice !== null ? Number(product.offerPrice) : null,
    priceOnRequest: product.priceOnRequest,
    quantity: product.quantity,
  }));
}

export function incompleteMessage(count: number) {
  return count === 1
    ? "1 product needs prices and stock before this catalogue can go live."
    : `${count} products need prices and stock before this catalogue can go live.`;
}
