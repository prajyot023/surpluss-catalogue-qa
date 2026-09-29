import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { reorderListingsSchema } from "@/lib/schemas/listing";
import { revalidateCatalogue } from "../helpers";

const idSchema = z.uuid();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid catalogue id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reorderListingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const prisma = getPrisma();
  const catalogue = await prisma.catalogue.findUnique({ where: { id }, select: { slug: true } });
  if (!catalogue) return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });

  const owned = await prisma.catalogueListing.count({
    where: { catalogueId: id, id: { in: orderedIds } },
  });
  if (owned !== orderedIds.length) {
    return NextResponse.json({ error: "The order doesn't match this catalogue's listings." }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      orderedIds.map((listingId, index) =>
        prisma.catalogueListing.update({ where: { id: listingId }, data: { displayOrder: index } }),
      ),
    );
    revalidateCatalogue(id, catalogue.slug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save the new order." }, { status: 500 });
  }
}
