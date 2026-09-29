import { connection } from "next/server";
import { NewCatalogueButton } from "@/components/admin/new-catalogue-button";
import { PageHeader } from "@/components/admin/page-header";
import { CataloguesTable, type CatalogueRow } from "@/components/admin/catalogues-table";
import { currentActor, isAdmin } from "@/auth-guards";
import { effectiveStatus } from "@/lib/catalogue-status";
import { getPrisma } from "@/lib/prisma";

export default async function CataloguesPage() {
  await connection();
  const actor = await currentActor();
  const catalogues = await getPrisma().catalogue.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { listings: true, enquiries: true } } },
  });

  const rows: CatalogueRow[] = catalogues.map((catalogue) => ({
    id: catalogue.id,
    name: catalogue.name,
    slug: catalogue.slug,
    category: catalogue.category,
    products: catalogue._count.listings,
    leads: catalogue._count.enquiries,
    updatedAt: catalogue.updatedAt.toISOString(),
    status: effectiveStatus(catalogue.status, catalogue.expiresAt),
  }));

  return (
    <>
      <PageHeader
        title="Catalogues"
        description="Create, publish and manage buyer-facing inventory collections."
        action={<NewCatalogueButton />}
      />
      <CataloguesTable rows={rows} canManage={isAdmin(actor)} />
    </>
  );
}
