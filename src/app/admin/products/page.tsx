import { connection } from "next/server";
import { PageHeader } from "@/components/admin/page-header";
import { ProductsTable, type AdminProductRow } from "@/components/admin/products-table";
import { getPrisma } from "@/lib/prisma";

function toAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .map(([k, v]) => [k, String(v)]),
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await connection();
  const { view } = await searchParams;
  const prisma = getPrisma();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { listings: true } },
      stocks: {
        select: {
          quantity: true,
          city: { select: { placeId: true, name: true, region: true } },
        },
        orderBy: { quantity: "desc" },
      },
    },
  });

  const rows: AdminProductRow[] = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    images: product.imageUrls,
    mrp: product.mrp !== null ? Number(product.mrp) : null,
    offerPrice: product.offerPrice !== null ? Number(product.offerPrice) : null,
    priceOnRequest: product.priceOnRequest,
    quantity: product.quantity,
    moq: product.moq,
    attributes: toAttributes(product.attributes),
    catalogues: product._count.listings,
    archived: product.archivedAt !== null,
    stocks: product.stocks.map((stock) => ({
      placeId: stock.city.placeId,
      name: stock.city.name,
      region: stock.city.region,
      quantity: stock.quantity,
    })),
  }));

  return (
    <>
      <PageHeader
        title="Product library"
        description="All your products in one place. Prices set here apply everywhere a product appears."
      />
      <ProductsTable rows={rows} initialViewId={typeof view === "string" ? view : undefined} />
    </>
  );
}
