import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { effectiveStatus } from "@/lib/catalogue-status";
import { getPrisma } from "@/lib/prisma";

const querySchema = z.string().trim().min(1).max(120);

export type GlobalSearchResults = {
  products: { id: string; name: string; sku: string; image: string | null; offerPrice: number | null; archived: boolean }[];
  catalogues: { id: string; name: string; slug: string; status: string }[];
  leads: { reference: string; buyerName: string; company: string | null; status: string }[];
};

/** One query across products, catalogues and leads for the command palette. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(searchParams.get("q") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ products: [], catalogues: [], leads: [] } satisfies GlobalSearchResults);
  }
  const q = parsed.data;
  const prisma = getPrisma();

  const [products, catalogues, leads] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: 5,
      select: { id: true, name: true, sku: true, imageUrls: true, offerPrice: true, archivedAt: true },
    }),
    prisma.catalogue.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, status: true, expiresAt: true },
    }),
    prisma.enquiry.findMany({
      where: {
        OR: [
          { buyerName: { contains: q, mode: "insensitive" } },
          { reference: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { reference: true, buyerName: true, company: true, status: true },
    }),
  ]);

  const results: GlobalSearchResults = {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      image: product.imageUrls[0] ?? null,
      offerPrice: product.offerPrice !== null ? Number(product.offerPrice) : null,
      archived: product.archivedAt !== null,
    })),
    catalogues: catalogues.map((catalogue) => ({
      id: catalogue.id,
      name: catalogue.name,
      slug: catalogue.slug,
      status: effectiveStatus(catalogue.status, catalogue.expiresAt),
    })),
    leads: leads.map((lead) => ({
      reference: lead.reference,
      buyerName: lead.buyerName,
      company: lead.company,
      status: lead.status,
    })),
  };

  return NextResponse.json(results);
}
