import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { listingBadgeSchema } from "@/lib/badges";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const presets = await getPrisma().badgePreset.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    presets: presets.map(({ id, text, bg, fg }) => ({ id, text, bg, fg })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = listingBadgeSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Please check the badge details.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const existing = await prisma.badgePreset.findFirst({
    where: { text: { equals: parsed.data.text, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A badge with this text already exists." }, { status: 409 });
  }

  try {
    const preset = await prisma.badgePreset.create({ data: parsed.data });
    return NextResponse.json(
      { ok: true, preset: { id: preset.id, text: preset.text, bg: preset.bg, fg: preset.fg } },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Could not save the badge." }, { status: 500 });
  }
}
