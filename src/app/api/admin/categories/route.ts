import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

/** Distinct values already in use (categories or brands), for the picker dropdowns. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind");
  const kind = kindParam === "catalogue" || kindParam === "brand" ? kindParam : "product";
  const prisma = getPrisma();

  let values: (string | null)[];
  if (kind === "catalogue") {
    const records = await prisma.catalogue.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    values = records.map(({ category }) => category);
  } else if (kind === "brand") {
    const records = await prisma.product.findMany({
      where: { brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });
    values = records.map(({ brand }) => brand);
  } else {
    const records = await prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    values = records.map(({ category }) => category);
  }

  const categories = values.filter((value): value is string => Boolean(value?.trim()));
  return NextResponse.json({ categories });
}
