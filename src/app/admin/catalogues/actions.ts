"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import {
  catalogueBannersSchema,
  catalogueCreateSchema,
  type CatalogueBanner,
  type CatalogueCreateInput,
} from "@/lib/schemas/catalogue";
import type { IncompleteProduct } from "@/lib/schemas/product";
import { INCOMPLETE_PRODUCT_WHERE, incompleteMessage } from "@/lib/incomplete";
import { validUntilToExpiresAt } from "@/app/api/admin/catalogues/helpers";

export type CreateCatalogueResult =
  | { ok: true; catalogueId: string; slug: string; published: boolean }
  | {
      error: string;
      fieldErrors?: Record<string, string[]>;
      incompleteProducts?: IncompleteProduct[];
    };

export type UpdateCatalogueBannersResult = { ok: true } | { error: string };

export async function updateCatalogueBanners(
  catalogueId: string,
  banners: CatalogueBanner[],
): Promise<UpdateCatalogueBannersResult> {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };

  const parsedId = z.uuid().safeParse(catalogueId);
  const parsedBanners = catalogueBannersSchema.safeParse(banners);
  if (!parsedId.success || !parsedBanners.success) {
    return { error: "Please check the banner images and actions." };
  }

  try {
    const catalogue = await getPrisma().catalogue.update({
      where: { id: parsedId.data },
      data: { banners: parsedBanners.data },
      select: { slug: true },
    });
    revalidatePath(`/admin/catalogues/${parsedId.data}`);
    revalidatePath(`/catalogue/${catalogue.slug}`);
    return { ok: true };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return { error: "Catalogue not found. Refresh and try again." };
    }
    return { error: "Could not save the banners. Please try again." };
  }
}

export async function createCatalogueWithProducts(input: CatalogueCreateInput): Promise<CreateCatalogueResult> {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = catalogueCreateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "input");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { error: "Please check the catalogue details.", fieldErrors };
  }
  const { name, slug, description, category, validUntil, banners, publish, productIds } = parsed.data;
  const prisma = getPrisma();

  // Publish gate: every selected product needs both prices and stock before going live.
  if (publish && productIds.length) {
    const incomplete = await prisma.product.findMany({
      where: { id: { in: productIds }, ...INCOMPLETE_PRODUCT_WHERE },
      select: {
        id: true,
        sku: true,
        name: true,
        mrp: true,
        offerPrice: true,
        priceOnRequest: true,
        quantity: true,
      },
    });
    if (incomplete.length) {
      return {
        error: incompleteMessage(incomplete.length),
        incompleteProducts: incomplete.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          mrp: product.mrp !== null ? Number(product.mrp) : null,
          offerPrice: product.offerPrice !== null ? Number(product.offerPrice) : null,
          priceOnRequest: product.priceOnRequest,
          quantity: product.quantity,
        })),
      };
    }
  }

  try {
    const catalogue = await prisma.$transaction(async (tx) => {
      const created = await tx.catalogue.create({
        data: {
          name,
          slug,
          description,
          category: category || null,
          banners,
          status: publish ? "published" : "draft",
          publishedAt: publish ? new Date() : null,
          expiresAt: validUntilToExpiresAt(validUntil),
        },
        select: { id: true, slug: true },
      });
      if (productIds.length) {
        await tx.catalogueListing.createMany({
          data: productIds.map((productId, index) => ({
            catalogueId: created.id,
            productId,
            displayOrder: index,
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/catalogues");
    revalidatePath(`/catalogue/${catalogue.slug}`);
    return { ok: true as const, catalogueId: catalogue.id, slug: catalogue.slug, published: publish };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return {
        error: `The link "${slug}" is already in use. Pick a different one.`,
        fieldErrors: { slug: ["This link is already in use."] },
      };
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      return { error: "One of the selected products no longer exists. Refresh and try again." };
    }
    return { error: "Could not create the catalogue. Please try again." };
  }
}
