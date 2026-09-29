"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { OFFER_PRICE_REQUIRED_MESSAGE } from "@/lib/pricing";
import { revalidateCatalogue } from "@/lib/revalidate";
import {
  productDescriptionSchema,
  productFieldMessage,
  productNameSchema,
  productPricesUpdateSchema,
} from "@/lib/schemas/product";

const money = z.number().nonnegative().max(999_999_999);

const productFieldsSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: productNameSchema,
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  description: productDescriptionSchema.optional().or(z.literal("")),
  mrp: money.nullable().optional(),
  offerPrice: money.nullable().optional(),
  priceOnRequest: z.boolean().optional(),
  quantity: z.number().int().min(0).max(10_000_000).optional(),
  moq: z.number().int().min(1).max(10_000_000).optional(),
  imageUrls: z.array(z.string().trim().url().startsWith("https://").max(500)).max(8).optional(),
});

const productInputSchema = productFieldsSchema.superRefine((input, ctx) => {
  if (input.priceOnRequest === true) return;
  if (input.offerPrice === null || input.offerPrice === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["offerPrice"],
      message: OFFER_PRICE_REQUIRED_MESSAGE,
    });
  }
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Names the offending field when the schema has a message for admins, so the
 * save toast can say what to fix instead of only that something is wrong. */
function productInputError(error: z.ZodError) {
  return productFieldMessage(error) ?? "Please check the product details.";
}

// Decimal columns take strings to avoid float drift.
function toDecimal(value: number | null | undefined) {
  if (value === undefined) return undefined;
  return value === null ? null : value.toFixed(2);
}

function toData(input: ProductInput) {
  const priceOnRequest = input.priceOnRequest ?? false;
  return {
    sku: input.sku,
    name: input.name,
    brand: input.brand || null,
    category: input.category || null,
    description: input.description || "",
    mrp: toDecimal(input.mrp),
    offerPrice: priceOnRequest ? null : toDecimal(input.offerPrice),
    priceOnRequest,
    quantity: input.quantity,
    moq: input.moq,
    imageUrls: input.imageUrls ?? [],
  };
}

const saleInfoSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      mrp: money.nullable(),
      offerPrice: money.nullable(),
      quantity: z.number().int().min(1).max(10_000_000),
    }),
  )
  .min(1)
  .max(500);

/** Fills in everything a product needs to appear in a live catalogue:
 * both prices and available stock. */
export async function completeProductsForSale(
  updates: { id: string; mrp: number | null; offerPrice: number | null; quantity: number }[],
) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = saleInfoSchema.safeParse(updates);
  if (!parsed.success) {
    return { error: "Every product needs MRP, offer price and a stock quantity above 0." };
  }
  const prisma = getPrisma();
  try {
    const onRequest = new Set(
      (
        await prisma.product.findMany({
          where: { id: { in: parsed.data.map(({ id }) => id) }, priceOnRequest: true },
          select: { id: true },
        })
      ).map(({ id }) => id),
    );
    const stillMissing = parsed.data.some(
      ({ id, mrp, offerPrice }) => !onRequest.has(id) && (mrp === null || offerPrice === null),
    );
    if (stillMissing) {
      return { error: "Every product needs MRP, offer price and a stock quantity above 0." };
    }
    // Located products keep their derived total; writing quantity here would
    // desync it from the per-city rows.
    const located = await prisma.productStock.findMany({
      where: { productId: { in: parsed.data.map(({ id }) => id) } },
      select: { productId: true },
      distinct: ["productId"],
    });
    const locatedIds = new Set(located.map(({ productId }) => productId));
    await prisma.$transaction(
      parsed.data.map(({ id, mrp, offerPrice, quantity }) =>
        prisma.product.update({
          where: { id },
          data: {
            mrp: mrp === null ? null : mrp.toFixed(2),
            offerPrice:
              onRequest.has(id) || offerPrice === null ? null : offerPrice.toFixed(2),
            ...(locatedIds.has(id) ? {} : { quantity }),
          },
        }),
      ),
    );
    revalidatePath("/admin/products");
    const catalogues = await prisma.catalogue.findMany({
      where: {
        status: "published",
        listings: { some: { productId: { in: parsed.data.map(({ id }) => id) } } },
      },
      select: { id: true, slug: true },
    });
    for (const catalogue of catalogues) revalidateCatalogue(catalogue.id, catalogue.slug);
    return { ok: true as const, updated: parsed.data.length };
  } catch {
    return { error: "Could not save the details." };
  }
}

export async function updateProductPrices(
  updates: { id: string; mrp: number | null; offerPrice: number | null }[],
) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = productPricesUpdateSchema.safeParse(updates);
  if (!parsed.success) return { error: "Please check the prices. Use numbers with up to 2 decimals." };
  const prisma = getPrisma();
  try {
    const onRequest = new Set(
      (
        await prisma.product.findMany({
          where: { id: { in: parsed.data.map(({ id }) => id) }, priceOnRequest: true },
          select: { id: true },
        })
      ).map(({ id }) => id),
    );
    await prisma.$transaction(
      parsed.data.map(({ id, mrp, offerPrice }) =>
        prisma.product.update({
          where: { id },
          data: {
            mrp: toDecimal(mrp),
            offerPrice: onRequest.has(id) ? null : toDecimal(offerPrice),
          },
        }),
      ),
    );
    revalidatePath("/admin/products");
    // Live catalogues showing these products need fresh prices too.
    const catalogues = await prisma.catalogue.findMany({
      where: {
        status: "published",
        listings: { some: { productId: { in: parsed.data.map(({ id }) => id) } } },
      },
      select: { id: true, slug: true },
    });
    for (const catalogue of catalogues) revalidateCatalogue(catalogue.id, catalogue.slug);
    return { ok: true as const, updated: parsed.data.length };
  } catch {
    return { error: "Could not save the prices." };
  }
}

const cityRefSchema = z.object({
  placeId: z.string().trim().min(1).max(300),
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().max(160).nullable(),
});

export type CityRef = z.infer<typeof cityRefSchema>;

const stockQuantity = z.number().int().min(0).max(10_000_000);

const stockUpdatesSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      // Desired per-city rows. null = the product stays unlocated and only
      // its plain quantity is written (when provided).
      stocks: z.array(z.object({ city: cityRefSchema, quantity: stockQuantity })).max(50).nullable(),
      quantity: stockQuantity.optional(),
    }),
  )
  .min(1)
  .max(500);

export type ProductStockUpdate = z.infer<typeof stockUpdatesSchema>[number];

async function refreshCataloguesFor(productIds: string[]) {
  const prisma = getPrisma();
  const catalogues = await prisma.catalogue.findMany({
    where: { status: "published", listings: { some: { productId: { in: productIds } } } },
    select: { id: true, slug: true },
  });
  for (const catalogue of catalogues) revalidateCatalogue(catalogue.id, catalogue.slug);
}

/** Saves per-city stock. A product with city rows gets its quantity derived
 * (sum of rows) in the same transaction; an empty rows list removes the
 * breakdown and leaves the total as-is. */
export async function updateProductStocks(updates: ProductStockUpdate[]) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = stockUpdatesSchema.safeParse(updates);
  if (!parsed.success) return { error: "Please check the stock numbers. Use whole numbers of 0 or more." };
  const prisma = getPrisma();
  try {
    await prisma.$transaction(
      async (tx) => {
        // One city row per distinct place across the whole batch.
        const cityIds = new Map<string, string>();
        for (const update of parsed.data) {
          for (const { city } of update.stocks ?? []) {
            if (cityIds.has(city.placeId)) continue;
            const record = await tx.city.upsert({
              where: { placeId: city.placeId },
              update: {},
              create: { placeId: city.placeId, name: city.name, region: city.region },
              select: { id: true },
            });
            cityIds.set(city.placeId, record.id);
          }
        }
        for (const update of parsed.data) {
          if (update.stocks === null) {
            // Plain quantity edit; only valid while the product is unlocated.
            if (update.quantity === undefined) continue;
            const located = await tx.productStock.count({ where: { productId: update.id } });
            if (located === 0) {
              await tx.product.update({ where: { id: update.id }, data: { quantity: update.quantity } });
            }
            continue;
          }
          const keep = update.stocks.map(({ city }) => cityIds.get(city.placeId) as string);
          await tx.productStock.deleteMany({
            where: { productId: update.id, cityId: { notIn: keep } },
          });
          for (const { city, quantity } of update.stocks) {
            const cityId = cityIds.get(city.placeId) as string;
            await tx.productStock.upsert({
              where: { productId_cityId: { productId: update.id, cityId } },
              update: { quantity },
              create: { productId: update.id, cityId, quantity },
            });
          }
          if (update.stocks.length > 0) {
            const total = update.stocks.reduce((sum, { quantity }) => sum + quantity, 0);
            await tx.product.update({ where: { id: update.id }, data: { quantity: total } });
          }
        }
      },
      { timeout: 60_000 },
    );
    revalidatePath("/admin/products");
    await refreshCataloguesFor(parsed.data.map(({ id }) => id));
    return { ok: true as const, updated: parsed.data.length };
  } catch {
    return { error: "Could not save the stock." };
  }
}

/** Moves each selected product's stock into one city: its current quantity
 * becomes that city's stock. Products that already have city rows are skipped
 * so a bulk assign can never overwrite an existing breakdown. */
export async function assignProductsToCity(ids: string[], city: CityRef) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsedIds = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  const parsedCity = cityRefSchema.safeParse(city);
  if (!parsedIds.success || !parsedCity.success) return { error: "Invalid selection." };
  const prisma = getPrisma();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const cityRecord = await tx.city.upsert({
          where: { placeId: parsedCity.data.placeId },
          update: {},
          create: {
            placeId: parsedCity.data.placeId,
            name: parsedCity.data.name,
            region: parsedCity.data.region,
          },
          select: { id: true },
        });
        const products = await tx.product.findMany({
          where: { id: { in: parsedIds.data } },
          select: { id: true, quantity: true, _count: { select: { stocks: true } } },
        });
        const unlocated = products.filter((product) => product._count.stocks === 0);
        if (unlocated.length) {
          await tx.productStock.createMany({
            data: unlocated.map((product) => ({
              productId: product.id,
              cityId: cityRecord.id,
              quantity: product.quantity,
            })),
          });
        }
        return { assigned: unlocated.length, skipped: products.length - unlocated.length };
      },
      { timeout: 60_000 },
    );
    revalidatePath("/admin/products");
    return { ok: true as const, ...result };
  } catch {
    return { error: "Could not assign the city." };
  }
}

const categoryName = z.string().trim().min(1).max(80);

/** Sets (or clears, with null) the category on the selected products. */
export async function setProductsCategory(ids: string[], category: string | null) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsedIds = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  const parsedCategory = categoryName.nullable().safeParse(category);
  if (!parsedIds.success || !parsedCategory.success) return { error: "Invalid selection." };
  const prisma = getPrisma();
  try {
    const result = await prisma.product.updateMany({
      where: { id: { in: parsedIds.data } },
      data: { category: parsedCategory.data },
    });
    revalidatePath("/admin/products");
    // Category feeds the filter chips on live catalogue pages.
    await refreshCataloguesFor(parsedIds.data);
    return { ok: true as const, updated: result.count };
  } catch {
    return { error: "Could not update the category." };
  }
}

/** Moves every product in one category to another. Covers rename (new name),
 * merge (existing name) and delete (null clears the category; products stay). */
export async function reassignCategory(from: string, to: string | null) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsedFrom = categoryName.safeParse(from);
  const parsedTo = categoryName.nullable().safeParse(to);
  if (!parsedFrom.success || !parsedTo.success) return { error: "Invalid category." };
  if (parsedFrom.data === parsedTo.data) return { error: "Pick a different category." };
  const prisma = getPrisma();
  try {
    const products = await prisma.product.findMany({
      where: { category: parsedFrom.data },
      select: { id: true },
    });
    if (!products.length) return { ok: true as const, updated: 0 };
    const result = await prisma.product.updateMany({
      where: { category: parsedFrom.data },
      data: { category: parsedTo.data },
    });
    revalidatePath("/admin/products");
    await refreshCataloguesFor(products.map((product) => product.id));
    return { ok: true as const, updated: result.count };
  } catch {
    return { error: "Could not update the category." };
  }
}

/** Retires products: removes them from every catalogue and stamps archived_at.
 * Live catalogues that listed them are revalidated so buyers stop seeing them. */
export async function archiveProducts(ids: string[]) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { error: "Invalid selection." };
  const prisma = getPrisma();
  try {
    // Capture the published catalogues to refresh before the listings go.
    const affected = await prisma.catalogue.findMany({
      where: { status: "published", listings: { some: { productId: { in: parsed.data } } } },
      select: { id: true, slug: true },
    });
    const [removed, archived] = await prisma.$transaction([
      prisma.catalogueListing.deleteMany({ where: { productId: { in: parsed.data } } }),
      prisma.product.updateMany({
        where: { id: { in: parsed.data }, archivedAt: null },
        data: { archivedAt: new Date() },
      }),
    ]);
    revalidatePath("/admin/products");
    revalidatePath("/admin/catalogues");
    for (const catalogue of affected) revalidateCatalogue(catalogue.id, catalogue.slug);
    return { ok: true as const, archived: archived.count, listingsRemoved: removed.count };
  } catch {
    return { error: "Could not archive the products." };
  }
}

export async function restoreProducts(ids: string[]) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { error: "Invalid selection." };
  try {
    const restored = await getPrisma().product.updateMany({
      where: { id: { in: parsed.data }, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    revalidatePath("/admin/products");
    return { ok: true as const, restored: restored.count };
  } catch {
    return { error: "Could not restore the products." };
  }
}

export async function createProduct(input: ProductInput) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { error: productInputError(parsed.error) };
  try {
    await getPrisma().product.create({ data: toData(parsed.data) });
    revalidatePath("/admin/products");
    return { ok: true as const };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: `A product with SKU ${parsed.data.sku} already exists.` };
    }
    return { error: "Could not create the product." };
  }
}
export async function duplicateProduct(
  sourceProductId: string,
  input: ProductInput,
) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };

  if (!z.string().uuid().safeParse(sourceProductId).success) {
    return { error: "Invalid source product." };
  }

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: productInputError(parsed.error) };
  }

  try {
    const prisma = getPrisma();
    const sourceProduct = await prisma.product.findUnique({
      where: { id: sourceProductId },
      select: { attributes: true },
    });

    if (!sourceProduct) {
      return { error: "The source product no longer exists." };
    }

    await prisma.product.create({
      data: {
        ...toData(parsed.data),
        attributes: sourceProduct.attributes ?? {},
      },
    });

    revalidatePath("/admin/products");
    return { ok: true as const };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        error: `A product with SKU ${parsed.data.sku} already exists.`,
      };
    }

    return { error: "Could not duplicate the product." };
  }
}
export async function updateProduct(id: string, input: ProductInput) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid product." };
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { error: productInputError(parsed.error) };
  try {
    const prisma = getPrisma();
    const data = toData(parsed.data);
    // A located product's quantity is derived from its city rows.
    const located = await prisma.productStock.count({ where: { productId: id } });
    if (located > 0) data.quantity = undefined;
    await prisma.product.update({ where: { id }, data });
    revalidatePath("/admin/products");
    return { ok: true as const };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: `A product with SKU ${parsed.data.sku} already exists.` };
    }
    return { error: "Could not update the product." };
  }
}

export async function updateProductImages(id: string, imageUrls: string[]) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid product." };
  const parsed = z.array(z.string().trim().url().startsWith("https://").max(500)).max(8).safeParse(imageUrls);
  if (!parsed.success) return { error: "Please check the photos." };
  try {
    await getPrisma().product.update({ where: { id }, data: { imageUrls: parsed.data } });
    revalidatePath("/admin/products");
    return { ok: true as const };
  } catch {
    return { error: "Could not save the photos." };
  }
}

export async function deleteProducts(ids: string[]) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { error: "Invalid selection." };
  const prisma = getPrisma();
  try {
    const listed = await prisma.catalogueListing.findMany({
      where: { productId: { in: parsed.data } },
      select: { productId: true },
      distinct: ["productId"],
    });
    const listedIds = new Set(listed.map((listing) => listing.productId));
    const deletable = parsed.data.filter((id) => !listedIds.has(id));
    let deleted = 0;
    if (deletable.length) {
      const result = await prisma.product.deleteMany({ where: { id: { in: deletable } } });
      deleted = result.count;
    }
    revalidatePath("/admin/products");
    return { ok: true as const, deleted, skipped: parsed.data.length - deletable.length };
  } catch {
    return { error: "Could not delete the selected products." };
  }
}

export async function deleteProduct(id: string) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid product." };
  try {
    await getPrisma().product.delete({ where: { id } });
    revalidatePath("/admin/products");
    return { ok: true as const };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      return { error: "This product is listed in a catalogue. Remove it from all catalogues first." };
    }
    return { error: "Could not delete the product." };
  }
}
