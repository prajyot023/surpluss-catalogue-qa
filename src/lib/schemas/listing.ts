import { z } from "zod";
import { listingBadgesSchema, type ListingBadge } from "@/lib/badges";

export const updateListingSchema = z
  .object({
    isVisible: z.boolean().optional(),
    badges: listingBadgesSchema.optional(),
  })
  .refine((input) => input.isVisible !== undefined || input.badges !== undefined, {
    message: "Nothing to update",
  });

export const addListingsSchema = z.object({
  productIds: z.array(z.uuid()).min(1).max(500),
});

export const reorderListingsSchema = z.object({
  orderedIds: z.array(z.uuid()).min(1).max(2000),
});

export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type AddListingsInput = z.infer<typeof addListingsSchema>;

export type ListingRowDto = {
  listingId: string;
  isVisible: boolean;
  displayOrder: number;
  badges: ListingBadge[];
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: string | null;
    description: string;
    imageUrls: string[];
    mrp: number | null;
    offerPrice: number | null;
    priceOnRequest: boolean;
    quantity: number;
    moq: number;
  };
};

export type ProductSearchResult = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  mrp: number | null;
  offerPrice: number | null;
  priceOnRequest: boolean;
  quantity: number;
  alreadyListed: boolean;
};

/** Products per page in the product picker; the next page loads as the user scrolls. */
export const PRODUCT_SEARCH_PAGE_SIZE = 30;

export type ProductSearchPage = {
  products: ProductSearchResult[];
  /** Id of the last product on this page, or null when there are no more. */
  nextCursor: string | null;
};
