import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/** Live availability check for a catalogue link. excludeId lets the edit form
 * treat the catalogue's own current slug as available. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const slug = slugify(searchParams.get("slug") ?? "").slice(0, 120);
  if (!slug) return NextResponse.json({ available: false });

  const excludeParam = searchParams.get("excludeId");
  const excludeId = z.uuid().safeParse(excludeParam).success ? excludeParam : null;

  const existing = await getPrisma().catalogue.findUnique({
    where: { slug },
    select: { id: true },
  });
  const available = !existing || existing.id === excludeId;
  return NextResponse.json({ available });
}
