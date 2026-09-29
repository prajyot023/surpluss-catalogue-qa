"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import { currentActor, isAdmin } from "@/auth-guards";
import { getPrisma } from "@/lib/prisma";
import { findIncompleteProducts, incompleteMessage } from "@/lib/incomplete";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

const statusSchema = z.enum(["draft", "published"]);

export async function setCatalogueStatus(catalogueId: string, status: "draft" | "published") {
  const actor = await currentActor();
  if (!actor) return { error: "You need to sign in again." };
  if (!isAdmin(actor)) return { error: "Only an admin can change what is published." };
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success || !z.string().uuid().safeParse(catalogueId).success) {
    return { error: "Invalid request." };
  }
  try {
    if (parsedStatus.data === "published") {
      const incompleteProducts = await findIncompleteProducts(catalogueId);
      if (incompleteProducts.length > 0) {
        return { error: incompleteMessage(incompleteProducts.length), incompleteProducts };
      }
    }
    const catalogue = await getPrisma().catalogue.update({
      where: { id: catalogueId },
      data: {
        status: parsedStatus.data,
        publishedAt: parsedStatus.data === "published" ? new Date() : undefined,
      },
      select: { slug: true, name: true },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/catalogues");
    revalidatePath(`/catalogue/${catalogue.slug}`);
    return { ok: true as const, name: catalogue.name };
  } catch {
    return { error: "Could not update the catalogue." };
  }
}

export async function deleteCatalogue(catalogueId: string) {
  const actor = await currentActor();
  if (!actor) return { error: "You need to sign in again." };
  if (!z.string().uuid().safeParse(catalogueId).success) return { error: "Invalid catalogue." };
  try {
    const catalogue = await getPrisma().catalogue.delete({
      where: { id: catalogueId },
      select: { slug: true, name: true },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/catalogues");
    revalidatePath(`/catalogue/${catalogue.slug}`);
    return { ok: true as const, name: catalogue.name };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      return { error: "This catalogue has enquiries attached. Move it to draft instead to preserve lead history." };
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return { error: "This catalogue no longer exists." };
    }
    return { error: "Could not delete the catalogue." };
  }
}
