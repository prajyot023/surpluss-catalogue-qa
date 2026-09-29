import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { updateListingSchema } from "@/lib/schemas/listing";
import { revalidateCatalogue } from "../helpers";

const idSchema = z.uuid();

async function validateIds(params: Promise<{ id: string; listingId: string }>) {
  const { id, listingId } = await params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(listingId).success) return null;
  return { id, listingId };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; listingId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = await validateIds(params);
  if (!ids) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = updateListingSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Please check the listing details.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const catalogue = await prisma.catalogue.findUnique({ where: { id: ids.id }, select: { slug: true } });
  if (!catalogue) return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });

  try {
    const result = await prisma.catalogueListing.updateMany({
      where: { id: ids.listingId },
      data: parsed.data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    revalidateCatalogue(ids.id, catalogue.slug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update the listing." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; listingId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = await validateIds(params);
  if (!ids) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const prisma = getPrisma();
  const catalogue = await prisma.catalogue.findUnique({ where: { id: ids.id }, select: { slug: true } });
  if (!catalogue) return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });

  try {
    const result = await prisma.catalogueListing.deleteMany({
      where: { id: ids.listingId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    revalidateCatalogue(ids.id, catalogue.slug);
    return NextResponse.json({ ok: true });
  } catch {
    // Enquiry items keep a snapshot and detach automatically, so removal is always allowed.
    return NextResponse.json({ error: "Could not remove the product." }, { status: 500 });
  }
}
