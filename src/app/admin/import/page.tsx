import { redirect } from "next/navigation";

// The spreadsheet import now lives in a dialog on the Products page.
export default function ImportPage() {
  redirect("/admin/products");
}
