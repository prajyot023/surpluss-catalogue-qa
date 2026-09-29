import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { listingBadgeSchema } from "@/lib/badges";

const idSchema = z.uuid();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingBadgeSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Please check the badge details." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const duplicate = await prisma.badgePreset.findFirst({
    where: { id: { not: id }, text: { equals: parsed.data.text, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "A badge with this text already exists." }, { status: 409 });
  }

  try {
    // Listings hold inline copies, so edits only change the library entry.
    const result = await prisma.badgePreset.updateMany({ where: { id }, data: parsed.data });
    if (result.count === 0) {
      return NextResponse.json({ error: "Badge not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update the badge." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    // Applied badges are inline copies, so deleting a preset only removes it
    // from the library, never from products.
    const result = await getPrisma().badgePreset.deleteMany({ where: { id } });
    if (result.count === 0) {
      return NextResponse.json({ error: "Badge not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not remove the badge." }, { status: 500 });
  }
}
