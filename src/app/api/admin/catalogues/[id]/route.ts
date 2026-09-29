import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { catalogueEditSchema } from "@/lib/schemas/catalogue";
import { getPrisma } from "@/lib/prisma";
import { findIncompleteProducts, incompleteMessage } from "@/lib/incomplete";
import { CATALOGUE_INCLUDE as include, toCatalogueDto as toDto, validUntilToExpiresAt } from "../helpers";

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid catalogue id." }, { status: 400 });
  }

  const catalogue = await getPrisma().catalogue.findUnique({ where: { id }, include });
  if (!catalogue) return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });

  return NextResponse.json(toDto(catalogue));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid catalogue id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = catalogueEditSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Please check the catalogue details.",
        fieldErrors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const prisma = getPrisma();

  try {
    const existing = await prisma.catalogue.findUnique({ where: { id }, select: { slug: true, status: true } });
    if (!existing) return NextResponse.json({ error: "Catalogue not found." }, { status: 404 });

    if (input.status === "published" && existing.status !== "published") {
      const incompleteProducts = await findIncompleteProducts(id);
      if (incompleteProducts.length > 0) {
        return NextResponse.json(
          { error: incompleteMessage(incompleteProducts.length), incompleteProducts },
          { status: 409 },
        );
      }
    }

    const catalogue = await prisma.catalogue.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        category: input.category || null,
        notifyNumber: input.notifyNumber || null,
        status: input.status,
        banners: input.banners,
        expiresAt: validUntilToExpiresAt(input.validUntil),
        publishedAt:
          input.status === "published" && existing.status !== "published" ? new Date() : undefined,
      },
      include,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/catalogues");
    revalidatePath(`/admin/catalogues/${id}`);
    revalidatePath(`/catalogue/${existing.slug}`);
    if (catalogue.slug !== existing.slug) revalidatePath(`/catalogue/${catalogue.slug}`);

    return NextResponse.json({ ok: true, catalogue: toDto(catalogue) });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        {
          error: `The link "${input.slug}" is already in use. Pick a different one.`,
          fieldErrors: { slug: ["This link is already in use."] },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Could not update the catalogue." }, { status: 500 });
  }
}
