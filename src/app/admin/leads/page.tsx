import { connection } from "next/server";
import { PageHeader } from "@/components/admin/page-header";
import { LeadsTable, type LeadRow } from "@/components/admin/leads-table";
import { getPrisma } from "@/lib/prisma";

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  await connection();
  const { query, catalogueId } = await searchParams;
  const initialQuery = typeof query === "string" ? query : "";
  const initialCatalogueId = typeof catalogueId === "string" ? catalogueId : "";
  const prisma = getPrisma();
  const [enquiries, catalogues] = await Promise.all([
    prisma.enquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        catalogue: { select: { name: true } },
        items: { select: { requestedQuantity: true } },
      },
    }),
    prisma.catalogue.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const leads: LeadRow[] = enquiries.map((enquiry) => ({
    reference: enquiry.reference,
    buyerName: enquiry.buyerName,
    company: enquiry.company,
    phone: enquiry.phone ? `${enquiry.phoneCountryCode}${enquiry.phone}` : "",
    email: enquiry.email,
    catalogueId: enquiry.catalogueId,
    catalogueName: enquiry.catalogue.name,
    itemCount: enquiry.items.length,
    totalQuantity: enquiry.items.reduce((total, item) => total + item.requestedQuantity, 0),
    createdAt: enquiry.createdAt.toISOString(),
    status: enquiry.status,
  }));

  return (
    <>
      <PageHeader title="Leads" description="Review and sort buyer enquiries across every catalogue campaign." />
      <LeadsTable
        leads={leads}
        catalogues={catalogues}
        initialQuery={initialQuery}
        initialCatalogueId={
          catalogues.some((catalogue) => catalogue.id === initialCatalogueId)
            ? initialCatalogueId
            : undefined
        }
      />
    </>
  );
}
