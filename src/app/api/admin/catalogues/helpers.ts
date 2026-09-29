import { z } from "zod";
import { catalogueBannerSchema, type CatalogueBanner, type CatalogueDetailDto } from "@/lib/schemas/catalogue";

export type CatalogueRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string | null;
  status: "draft" | "published" | "inactive" | "expired";
  banners: unknown;
  notifyNumber: string | null;
  expiresAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { listings: number; enquiries: number };
  listings: { product: { category: string | null } }[];
};

export function parseBanners(value: unknown): CatalogueBanner[] {
  const parsed = z.array(catalogueBannerSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function toCatalogueDto(catalogue: CatalogueRecord): CatalogueDetailDto {
  return {
    id: catalogue.id,
    name: catalogue.name,
    slug: catalogue.slug,
    description: catalogue.description,
    category: catalogue.category ?? "",
    status: catalogue.status,
    banners: parseBanners(catalogue.banners),
    notifyNumber: catalogue.notifyNumber ?? "",
    validUntil: catalogue.expiresAt ? catalogue.expiresAt.toISOString().slice(0, 10) : null,
    publishedAt: catalogue.publishedAt?.toISOString() ?? null,
    createdAt: catalogue.createdAt.toISOString(),
    updatedAt: catalogue.updatedAt.toISOString(),
    products: catalogue._count.listings,
    enquiries: catalogue._count.enquiries,
    listedCategories: [
      ...new Set(
        catalogue.listings
          .map(({ product }) => product.category)
          .filter((category): category is string => Boolean(category?.trim())),
      ),
    ].sort((a, b) => a.localeCompare(b)),
  };
}

export const CATALOGUE_INCLUDE = {
  _count: { select: { listings: true, enquiries: true } },
  listings: { select: { product: { select: { category: true } } } },
} as const;

// Same IST end-of-day convention as the import flow.
export function validUntilToExpiresAt(validUntil: string | null) {
  return validUntil ? new Date(`${validUntil}T23:59:59.999+05:30`) : null;
}
