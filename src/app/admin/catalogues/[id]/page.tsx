import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CatalogueDetailActions } from "@/components/admin/catalogue-detail-actions";
import { CatalogueListingsManager } from "@/components/admin/catalogue-listings-manager";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { currentActor, isAdmin } from "@/auth-guards";
import { effectiveStatus } from "@/lib/catalogue-status";
import { parseBanners } from "@/app/api/admin/catalogues/helpers";
import { parseListingBadges, toBadgePresets } from "@/lib/badges";
import { getPrisma } from "@/lib/prisma";
import type { ListingRowDto } from "@/lib/schemas/listing";
import { cn } from "@/lib/utils";

export default async function CatalogueDetailPage({ params }: PageProps<"/admin/catalogues/[id]">) {
  await connection();
  const { id } = await params;
  const badgePresets = toBadgePresets(
    await getPrisma().badgePreset.findMany({ orderBy: { createdAt: "desc" } }),
  );
  const catalogue = await getPrisma().catalogue.findUnique({
    where: { id },
    include: {
      _count: { select: { listings: true, enquiries: true } },
      listings: {
        orderBy: { displayOrder: "asc" },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              brand: true,
              category: true,
              description: true,
              imageUrls: true,
              mrp: true,
              offerPrice: true,
              priceOnRequest: true,
              quantity: true,
              moq: true,
            },
          },
        },
      },
      enquiries: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { reference: true, buyerName: true, status: true, createdAt: true },
      },
    },
  });
  if (!catalogue) notFound();
  const actor = await currentActor();
  const status = effectiveStatus(catalogue.status, catalogue.expiresAt);
  const banners = parseBanners(catalogue.banners);
  const categories = [
    ...new Set(
      catalogue.listings
        .map((listing) => listing.product.category)
        .filter((category): category is string => Boolean(category?.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const listingRows: ListingRowDto[] = catalogue.listings.map((listing) => ({
    listingId: listing.id,
    isVisible: listing.isVisible,
    displayOrder: listing.displayOrder,
    badges: parseListingBadges(listing.badges),
    product: {
      id: listing.product.id,
      sku: listing.product.sku,
      name: listing.product.name,
      brand: listing.product.brand,
      category: listing.product.category,
      description: listing.product.description,
      imageUrls: listing.product.imageUrls,
      mrp: listing.product.mrp !== null ? Number(listing.product.mrp) : null,
      offerPrice: listing.product.offerPrice !== null ? Number(listing.product.offerPrice) : null,
      priceOnRequest: listing.product.priceOnRequest,
      quantity: listing.product.quantity,
      moq: listing.product.moq,
    },
  }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1.5">
            <Link
              href="/admin/catalogues"
              aria-label="Back to all catalogues"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-ml-1.5 text-slate-400 hover:text-brand")}
            >
              <ArrowLeft className="size-5" />
            </Link>
            {catalogue.name}
          </span>
        }
        description={[catalogue.category, `/catalogue/${catalogue.slug}`].filter(Boolean).join(" · ")}
        action={
          <CatalogueDetailActions
            catalogueId={catalogue.id}
            name={catalogue.name}
            slug={catalogue.slug}
            status={status}
            banners={banners}
            categories={categories}
            canManage={isAdmin(actor)}
          />
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <div className="space-y-5">
          <CatalogueListingsManager
            catalogueId={catalogue.id}
            published={status === "published"}
            rows={listingRows}
            badgePresets={badgePresets}
          />

          {catalogue.description && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Description</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{catalogue.description}</p>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Recent enquiries</h2>
                <Badge variant="outline" className="border-slate-200 text-slate-600">{catalogue._count.enquiries}</Badge>
              </div>
              <Link
                href={`/admin/leads?catalogueId=${catalogue.id}`}
                className="text-xs font-semibold text-brand hover:underline"
              >
                View all enquiries
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {catalogue.enquiries.map((enquiry) => (
                <Link
                  key={enquiry.reference}
                  href={`/admin/leads/${enquiry.reference}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{enquiry.buyerName}</p>
                    <p className="text-xs text-slate-500">{enquiry.reference} · {enquiry.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{enquiry.status}</Badge>
                </Link>
              ))}
              {!catalogue.enquiries.length && (
                <p className="py-3 text-sm text-slate-500">No enquiries for this catalogue yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Lead alerts</dt><dd className="font-medium">{catalogue.notifyNumber ? `+${catalogue.notifyNumber}` : "Team default"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Valid until</dt><dd className="font-medium">{catalogue.expiresAt ? catalogue.expiresAt.toLocaleDateString("en-IN", { dateStyle: "medium" }) : "No expiry"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Created</dt><dd className="font-medium">{catalogue.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Updated</dt><dd className="font-medium">{catalogue.updatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Published</dt><dd className="font-medium">{catalogue.publishedAt ? catalogue.publishedAt.toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Never"}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
