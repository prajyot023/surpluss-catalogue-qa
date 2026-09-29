import { connection } from "next/server";
import { PageHeader } from "@/components/admin/page-header";
import { ChartAreaInteractive, type EnquiryPoint } from "@/components/chart-area-interactive";
import { DataTable, type RecentLeadRow } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { getPrisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_DAYS = 90;

function getTimeWindows() {
  const now = Date.now();
  const chartStart = new Date(now - (CHART_DAYS - 1) * DAY_MS);
  chartStart.setUTCHours(0, 0, 0, 0);
  return {
    now,
    chartStart,
    last30: new Date(now - 30 * DAY_MS),
    prev30: new Date(now - 60 * DAY_MS),
  };
}

export default async function AdminDashboardPage() {
  await connection();
  const prisma = getPrisma();
  const { now, chartStart, last30, prev30 } = getTimeWindows();

  const [activeCatalogues, products, newLeads, openEnquiries, leadsLast30, leadsPrev30, recentEnquiries, chartEnquiries] =
    await Promise.all([
      prisma.catalogue.count({
        // Live means published AND still within its validity date.
        where: { status: "published", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(now) } }] },
      }),
      prisma.product.count(),
      prisma.enquiry.count({ where: { status: "new" } }),
      prisma.enquiry.count({ where: { status: { in: ["new", "contacted"] } } }),
      prisma.enquiry.count({ where: { createdAt: { gte: last30 } } }),
      prisma.enquiry.count({ where: { createdAt: { gte: prev30, lt: last30 } } }),
      prisma.enquiry.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          catalogue: { select: { name: true } },
          items: { select: { requestedQuantity: true } },
        },
      }),
      prisma.enquiry.findMany({
        where: { createdAt: { gte: chartStart } },
        select: { createdAt: true },
      }),
    ]);

  const countsByDay = new Map<string, number>();
  for (const enquiry of chartEnquiries) {
    const key = enquiry.createdAt.toISOString().slice(0, 10);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }
  const chartData: EnquiryPoint[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const key = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    chartData.push({ date: key, enquiries: countsByDay.get(key) ?? 0 });
  }

  const recentLeads: RecentLeadRow[] = recentEnquiries.map((enquiry, index) => ({
    id: index + 1,
    reference: enquiry.reference,
    buyerName: enquiry.buyerName,
    company: enquiry.company,
    catalogueName: enquiry.catalogue.name,
    totalQuantity: enquiry.items.reduce((total, item) => total + item.requestedQuantity, 0),
    status: enquiry.status,
    createdAt: enquiry.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Dashboard"
        description="Overview of catalogues, products and buyer enquiries."
      />
      <SectionCards
        stats={{
          activeCatalogues,
          products,
          newLeads,
          openEnquiries,
          leadsLast30,
          leadsPrev30,
        }}
      />
      <ChartAreaInteractive data={chartData} />
      <DataTable data={recentLeads} />
    </div>
  );
}
