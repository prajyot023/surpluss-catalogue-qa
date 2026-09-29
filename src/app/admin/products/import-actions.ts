"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import {
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MAX_MESSAGE,
  productDescriptionSchema,
} from "@/lib/schemas/product";

const skusSchema = z.array(z.string().trim().min(1).max(60)).min(1).max(2000);

/** SKUs from the sheet that already exist in the product library. */
export async function checkExistingSkus(skus: string[]): Promise<{ existing: string[] } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = skusSchema.safeParse(skus);
  if (!parsed.success) return { error: "Please check the sheet and try again." };
  const products = await getPrisma().product.findMany({
    where: { sku: { in: parsed.data } },
    select: { sku: true },
  });
  return { existing: products.map(({ sku }) => sku) };
}

const importRowSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(PRODUCT_NAME_MAX_LENGTH, PRODUCT_NAME_MAX_MESSAGE),
  brand: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  description: productDescriptionSchema.optional(),
  imageUrl: z.string().trim().url().startsWith("https://").max(500).optional(),
  offerPrice: z.number().nonnegative().finite().optional(),
  mrp: z.number().nonnegative().finite().optional(),
  quantity: z.number().int().nonnegative(),
  moq: z.number().int().positive().optional(),
  attributes: z.record(z.string(), z.string().max(300)).optional(),
});

const importInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  columnMapping: z.record(z.string(), z.string()),
  updateExisting: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(2000),
});

export type ImportProductsInput = z.infer<typeof importInputSchema>;

export type ImportedProduct = { id: string; sku: string; name: string; hasImage: boolean };

export type ImportProductsResult =
  | {
      ok: true;
      created: number;
      updated: number;
      skippedExisting: number;
      /** Updated products whose per-city stock was preserved, so the sheet's
       * quantity column was ignored for them. */
      keptStock: number;
      /** Rows whose SKU is archived; imports never touch or resurrect those. */
      skippedArchived: number;
      products: ImportedProduct[];
    }
  | { error: string };

export async function importProducts(input: ImportProductsInput): Promise<ImportProductsResult> {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsed = importInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Please check the import details." };
  }
  const { fileName, columnMapping, updateExisting, rows } = parsed.data;
  const prisma = getPrisma();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.product.findMany({
          where: { sku: { in: rows.map(({ sku }) => sku) } },
          select: { sku: true, archivedAt: true, _count: { select: { stocks: true } } },
        });
        const existingSkus = new Set(existing.map(({ sku }) => sku));
        // Resurrection stays a deliberate act via Restore, never a side effect
        // of a routine sheet import.
        const archivedSkus = new Set(
          existing.filter(({ archivedAt }) => archivedAt !== null).map(({ sku }) => sku),
        );
        // Products split by city keep their breakdown; an import must never
        // silently overwrite it with one flat number.
        const locatedSkus = new Set(
          existing.filter(({ _count }) => _count.stocks > 0).map(({ sku }) => sku),
        );

        const products: ImportedProduct[] = [];
        let created = 0;
        let updated = 0;
        let skippedExisting = 0;
        let keptStock = 0;
        let skippedArchived = 0;

        for (const row of rows) {
          if (archivedSkus.has(row.sku)) {
            skippedArchived += 1;
            continue;
          }
          if (existingSkus.has(row.sku) && !updateExisting) {
            skippedExisting += 1;
            continue;
          }
          if (existingSkus.has(row.sku)) {
            if (locatedSkus.has(row.sku)) keptStock += 1;
            // Only defined sheet values are written, so blank cells never erase data.
            const record = await tx.product.update({
              where: { sku: row.sku },
              data: {
                name: row.name,
                brand: row.brand ?? undefined,
                category: row.category ?? undefined,
                description: row.description ?? undefined,
                mrp: row.mrp !== undefined ? row.mrp.toFixed(2) : undefined,
                offerPrice: row.offerPrice !== undefined ? row.offerPrice.toFixed(2) : undefined,
                quantity: locatedSkus.has(row.sku) ? undefined : row.quantity,
                moq: row.moq ?? undefined,
                ...(row.imageUrl ? { imageUrls: [row.imageUrl] } : {}),
                ...(row.attributes && Object.keys(row.attributes).length ? { attributes: row.attributes } : {}),
              },
              select: { id: true, imageUrls: true },
            });
            updated += 1;
            products.push({ id: record.id, sku: row.sku, name: row.name, hasImage: record.imageUrls.length > 0 });
          } else {
            const record = await tx.product.create({
              data: {
                sku: row.sku,
                name: row.name,
                brand: row.brand ?? null,
                category: row.category ?? null,
                description: row.description ?? "",
                mrp: row.mrp !== undefined ? row.mrp.toFixed(2) : null,
                offerPrice: row.offerPrice !== undefined ? row.offerPrice.toFixed(2) : null,
                quantity: row.quantity,
                moq: row.moq ?? 1,
                imageUrls: row.imageUrl ? [row.imageUrl] : [],
                attributes: row.attributes ?? {},
              },
              select: { id: true, imageUrls: true },
            });
            created += 1;
            products.push({ id: record.id, sku: row.sku, name: row.name, hasImage: record.imageUrls.length > 0 });
          }
        }

        await tx.importJob.create({
          data: {
            fileName,
            status: "completed",
            columnMapping,
            rowCount: rows.length,
            validCount: created + updated,
            errorCount: 0,
          },
        });

        return { created, updated, skippedExisting, keptStock, skippedArchived, products };
      },
      { timeout: 120_000 },
    );

    revalidatePath("/admin/products");
    return { ok: true as const, ...result };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "Another import added some of these products at the same time. Run the import again to update them." };
    }
    return { error: "The import failed while saving. Nothing was added. Fix the sheet and try again." };
  }
}
