import { parseListingBadges } from "@/lib/badges";
import type { ListingRowDto } from "@/lib/schemas/listing";

export { revalidateCatalogue } from "@/lib/revalidate";

export function isPrismaError(error: unknown, code: string) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}

type ListingWithProduct = {
  id: string;
  isVisible: boolean;
  displayOrder: number;
  badges: unknown;
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: string | null;
    description: string;
    imageUrls: string[];
    mrp: { toNumber(): number } | null;
    offerPrice: { toNumber(): number } | null;
    priceOnRequest: boolean;
    quantity: number;
    moq: number;
  };
};

export function toListingDto(listing: ListingWithProduct): ListingRowDto {
  return {
    listingId: listing.id,
    isVisible: listing.isVisible,
    displayOrder: listing.displayOrder,
    badges: parseListingBadges(listing.badges),
    product: {
      id: listing.product.id,
      sku: listing.product.sku,
      name: listing.product.name,
      brand: listing.product.brand,
      category: listing.product.category,
      description: listing.product.description,
      imageUrls: listing.product.imageUrls,
      mrp: listing.product.mrp !== null ? Number(listing.product.mrp) : null,
      offerPrice: listing.product.offerPrice !== null ? Number(listing.product.offerPrice) : null,
      priceOnRequest: listing.product.priceOnRequest,
      quantity: listing.product.quantity,
      moq: listing.product.moq,
    },
  };
}

export const PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  brand: true,
  category: true,
  description: true,
  imageUrls: true,
  mrp: true,
  offerPrice: true,
  priceOnRequest: true,
  quantity: true,
  moq: true,
} as const;
