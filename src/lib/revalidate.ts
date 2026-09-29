import { revalidatePath } from "next/cache";

export function revalidateCatalogue(id: string, slug: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/catalogues");
  revalidatePath(`/admin/catalogues/${id}`);
  revalidatePath(`/catalogue/${slug}`);
}
