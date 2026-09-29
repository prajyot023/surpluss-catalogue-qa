"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

const statusSchema = z.enum(["new", "contacted", "qualified", "won", "lost", "spam"]);
const referenceSchema = z.string().trim().min(1).max(40);

export async function updateLeadStatus(reference: string, status: z.infer<typeof statusSchema>) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsedReference = referenceSchema.safeParse(reference);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedReference.success || !parsedStatus.success) return { error: "Invalid request." };
  try {
    await getPrisma().enquiry.update({
      where: { reference: parsedReference.data },
      data: { status: parsedStatus.data },
    });
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${parsedReference.data}`);
    return { ok: true as const };
  } catch {
    return { error: "Could not update the lead status." };
  }
}

export async function saveLeadNotes(reference: string, notes: string) {
  const session = await auth();
  if (!session) return { error: "You need to sign in again." };
  const parsedReference = referenceSchema.safeParse(reference);
  const parsedNotes = z.string().max(4000).safeParse(notes);
  if (!parsedReference.success || !parsedNotes.success) return { error: "Invalid request." };
  try {
    await getPrisma().enquiry.update({
      where: { reference: parsedReference.data },
      data: { internalNotes: parsedNotes.data.trim() || null },
    });
    revalidatePath(`/admin/leads/${parsedReference.data}`);
    return { ok: true as const };
  } catch {
    return { error: "Could not save the notes." };
  }
}
