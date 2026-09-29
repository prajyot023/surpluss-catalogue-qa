import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { INCOMPLETE_PRODUCT_WHERE } from "@/lib/incomplete";
import { getPrisma } from "@/lib/prisma";
import { addListingsSchema } from "@/lib/schemas/listing";
import { revalidateCatalogue } from "./helpers";

const idSchema = z.uuid();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid catalogue id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addListingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please choose at least one product." }, { status: 400 });
  }

  const prisma = getPrisma();
  const catalogue = await prisma.catalogue.findUnique({ where: { id }, select: { slug: true, status: true } });
  if (!catalogue) return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });

  // A live catalogue only accepts products that are ready to sell:
  // both prices set and stock above 0.
  if (catalogue.status === "published") {
    const incomplete = await prisma.product.findMany({
      where: { id: { in: parsed.data.productIds }, ...INCOMPLETE_PRODUCT_WHERE },
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
      return NextResponse.json(
        {
          error:
            incomplete.length === 1
              ? "1 product needs prices and stock before it can join a live catalogue."
              : `${incomplete.length} products need prices and stock before they can join a live catalogue.`,
          incompleteProducts: incomplete.map((product) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            mrp: product.mrp !== null ? Number(product.mrp) : null,
            offerPrice: product.offerPrice !== null ? Number(product.offerPrice) : null,
            priceOnRequest: product.priceOnRequest,
            quantity: product.quantity,
          })),
        },
        { status: 409 },
      );
    }
  }

  try {
    const { _max } = await prisma.catalogueListing.aggregate({
      where: { catalogueId: id },
      _max: { displayOrder: true },
    });
    const startOrder = (_max.displayOrder ?? -1) + 1;
    const { count } = await prisma.catalogueListing.createMany({
      data: parsed.data.productIds.map((productId, index) => ({
        catalogueId: id,
        productId,
        displayOrder: startOrder + index,
      })),
      skipDuplicates: true,
    });

    revalidateCatalogue(id, catalogue.slug);
    return NextResponse.json({ ok: true, added: count }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not add the products." }, { status: 500 });
  }
}
