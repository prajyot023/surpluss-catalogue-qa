import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { parseListingBadges, type ListingBadge } from "@/lib/badges";
import { catalogueBannerSchema, type CatalogueBanner } from "@/lib/schemas/catalogue";

function parseBanners(value: unknown): CatalogueBanner[] {
  const parsed = z.array(catalogueBannerSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export type CatalogueView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string | null;
  banners: CatalogueBanner[];
  eyebrow: string;
  validUntil: string | null;
  whatsappNumber: string | null;
};

export type ProductView = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  price: number | null;
  mrp: number | null;
  priceOnRequest: boolean;
  quantity: number;
  moq: number;
  image: string | null;
  images: string[];
  description: string;
  attributes: Record<string, string>;
  badges: ListingBadge[];
};

function formatLongDate(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function toAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .map(([k, v]) => [k, String(v)]),
  );
}

export type ExpiredCatalogueInfo = { expired: true; title: string; whatsappNumber: string | null };

export async function getPublishedCatalogue(
  slug: string,
): Promise<{ catalogue: CatalogueView; products: ProductView[] } | ExpiredCatalogueInfo | null> {
  const prisma = getPrisma();
  const record = await prisma.catalogue.findUnique({
    where: { slug },
    include: {
      listings: {
        where: { isVisible: true },
        orderBy: { displayOrder: "asc" },
        include: { product: true },
      },
    },
  });
  if (!record || record.status !== "published") return null;
  if (record.expiresAt && record.expiresAt < new Date()) {
    return {
      expired: true,
      title: record.name,
      whatsappNumber: process.env.WATI_WHATSAPP_NUMBER || process.env.WATI_TEAM_NUMBER || null,
    };
  }

  const eyebrowDate = (record.publishedAt ?? record.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const catalogue: CatalogueView = {
    id: record.id,
    slug: record.slug,
    title: record.name,
    description: record.description,
    category: record.category,
    banners: parseBanners(record.banners),
    eyebrow: `${record.category ?? "Catalogue"} · ${eyebrowDate}`,
    validUntil: record.expiresAt ? formatLongDate(record.expiresAt) : null,
    whatsappNumber:
      process.env.WATI_WHATSAPP_NUMBER || process.env.WATI_TEAM_NUMBER || null,
  };

  const products: ProductView[] = record.listings.map((listing) => ({
    id: listing.productId,
    sku: listing.product.sku,
    name: listing.product.name,
    brand: listing.product.brand,
    category: listing.product.category ?? "Other",
    price:
      listing.product.priceOnRequest || listing.product.offerPrice === null
        ? null
        : Number(listing.product.offerPrice),
    mrp: listing.product.mrp !== null ? Number(listing.product.mrp) : null,
    priceOnRequest: listing.product.priceOnRequest,
    quantity: listing.product.quantity,
    moq: listing.product.moq,
    image: listing.product.imageUrls[0] ?? null,
    images: listing.product.imageUrls,
    description: listing.product.description,
    attributes: toAttributes(listing.product.attributes),
    badges: parseListingBadges(listing.badges),
  }));

  return { catalogue, products };
}

export async function getNewLeadsCount(): Promise<number> {
  return getPrisma().enquiry.count({ where: { status: "new" } });
}
