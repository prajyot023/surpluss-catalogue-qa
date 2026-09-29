import { z } from "zod";

export const CATALOGUE_EDIT_STATUSES = ["draft", "published"] as const;

export const BANNER_SORTS = ["featured", "discount", "price-asc", "price-desc"] as const;

/** A promo banner: an image plus an optional filter recipe applied when tapped. */
export const catalogueBannerSchema = z.object({
  imageUrl: z.url().startsWith("https://").max(500),
  filter: z
    .object({
      category: z.string().trim().max(80).nullable(),
      sort: z.enum(BANNER_SORTS).nullable(),
      minDiscount: z.number().int().min(0).max(90).nullable(),
    })
    .nullable(),
});

export type CatalogueBanner = z.infer<typeof catalogueBannerSchema>;
export type BannerFilter = NonNullable<CatalogueBanner["filter"]>;

export const catalogueBannersSchema = z.array(catalogueBannerSchema).max(3);

export const catalogueEditSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a link.")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only."),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters."),
  category: z.string().trim().max(80).or(z.literal("")),
  notifyNumber: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, "Digits only, with country code (e.g. 919876543210).")
    .or(z.literal("")),
  status: z.enum(CATALOGUE_EDIT_STATUSES),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .nullable(),
  banners: catalogueBannersSchema,
});

export type CatalogueEditInput = z.infer<typeof catalogueEditSchema>;

export const catalogueCreateSchema = catalogueEditSchema
  .pick({ name: true, slug: true, description: true, category: true, validUntil: true, banners: true })
  .extend({
    publish: z.boolean(),
    productIds: z.array(z.uuid()).max(2000),
  });

export type CatalogueCreateInput = z.infer<typeof catalogueCreateSchema>;

export type CatalogueDetailDto = Omit<CatalogueEditInput, "status"> & {
  id: string;
  // The DB also stores legacy statuses; the edit form only writes draft/published.
  status: "draft" | "published" | "inactive" | "expired";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  products: number;
  enquiries: number;
  /** Categories of the products listed in this catalogue, for banner filters. */
  listedCategories: string[];
};
