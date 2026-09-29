import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

const querySchema = z.object({ q: z.string().trim().min(1).max(120) });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsed = querySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid search." }, { status: 400 });

  const prisma = getPrisma();
  const catalogue = await prisma.catalogue.findUnique({
    where: { slug },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!catalogue) {
    return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });
  }

  const { q } = parsed.data;
  const listings = await prisma.catalogueListing.findMany({
    where: {
      catalogueId: catalogue.id,
      isVisible: true,
      product: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    select: {
      productId: true,
      product: { select: { name: true, sku: true, offerPrice: true } },
    },
    orderBy: { displayOrder: "asc" },
  });

  // The grid needs the ids; name/sku/price ride along so the search dropdown
  // can render a preview row without a second round trip.
  return NextResponse.json({
    ids: listings.map((listing) => listing.productId),
    matches: listings.map((listing) => ({
      id: listing.productId,
      name: listing.product.name,
      sku: listing.product.sku,
      offerPrice: listing.product.offerPrice,
    })),
  });
}
