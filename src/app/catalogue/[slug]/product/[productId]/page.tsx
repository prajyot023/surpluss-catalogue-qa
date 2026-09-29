import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeIndianRupee, Check } from "lucide-react";
import { IconTag } from "@tabler/icons-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductViewTracker } from "@/components/analytics/product-view-tracker";
import { PublicHeader } from "@/components/public-header";
import { ExpiredCatalogue } from "@/components/catalogue/expired-catalogue";
import { ProductActions } from "@/components/catalogue/product-actions";
import { ProductBadges } from "@/components/catalogue/product-badges";
import { ProductGallery } from "@/components/catalogue/product-gallery";
import { RichTextContent } from "@/components/catalogue/rich-text-content";
import { SiteFooter } from "@/components/catalogue/site-footer";
import {
  getPublishedCatalogue,
  type ProductView,
} from "@/lib/catalogue-queries";
import {
  discountPercent,
  priceLabel,
  PRICE_ON_REQUEST_LABEL,
  PRICE_ON_REQUEST_SUPPORT_COPY,
} from "@/lib/pricing";
import { hasRichTextContent, richTextToPlainText } from "@/lib/rich-text";
import { socialImage } from "@/lib/social-metadata";
import { money } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string; productId: string }> };

const PRIMARY_SPEC_COUNT = 7;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, productId } = await params;
  const data = await getPublishedCatalogue(slug);
  if (!data || "expired" in data) return {};

  const product = data.products.find((item) => item.id === productId);
  if (!product) return {};

  const description =
    richTextToPlainText(product.description) ||
    `${product.name} from ${data.catalogue.title}.`;
  const image = product.image ?? socialImage;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      url: `/catalogue/${slug}/product/${productId}`,
      siteName: "Surpluss",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [image],
    },
  };
}
function discountOf(product: ProductView) {
  return discountPercent({
    priceOnRequest: product.priceOnRequest,
    mrp: product.mrp,
    offerPrice: product.price,
  });
}

export default async function ProductPage({ params }: PageProps) {
  await connection();
  const { slug, productId } = await params;
  const data = await getPublishedCatalogue(slug);
  if (!data) notFound();
  if ("expired" in data) {
    return (
      <ExpiredCatalogue
        title={data.title}
        whatsappNumber={data.whatsappNumber}
      />
    );
  }
  const product = data.products.find((item) => item.id === productId);
  if (!product) notFound();
  const { catalogue } = data;
  const discount = discountOf(product);
  const hasDescription = hasRichTextContent(product.description);
  const specs = Object.entries(product.attributes);
  const primarySpecs = specs.slice(0, PRIMARY_SPEC_COUNT);
  const extraSpecs = specs.slice(PRIMARY_SPEC_COUNT);
  const related = data.products
    .filter((item) => item.id !== product.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-white">
      <ProductViewTracker
        product={{
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price,
        }}
        listId={slug}
      />
      <PublicHeader
        activePage="catalogue"
        catalogueSlug={slug}
        whatsappNumber={catalogue.whatsappNumber}
        whatsappMessage={`Hi Surpluss team! I'm interested in "${product.name}" from the "${catalogue.title}" catalogue.`}
      />

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Link
            href={`/catalogue/${slug}`}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand"
          >
            <ArrowLeft className="size-4" /> Back to catalogue
          </Link>
          <ProductGallery
            images={product.images}
            name={product.name}
            productId={product.id}
          />
          {/* {product.images.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">Photos are of the actual stock included in this product.</p>
          )} */}
        </div>

        <div className="pb-8">
          <ProductBadges badges={product.badges} inline className="mb-2.5" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {[product.brand, product.category].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-brand sm:text-4xl">
            {product.name}
          </h1>

          {product.priceOnRequest ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-600 text-white">
                  <BadgeIndianRupee className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-bold tracking-tight text-amber-700">
                    {PRICE_ON_REQUEST_LABEL}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {PRICE_ON_REQUEST_SUPPORT_COPY}
                  </p>
                  {product.mrp !== null && (
                    <p className="mt-1.5 text-sm text-slate-400">
                      MRP{" "}
                      <span className="line-through">{money(product.mrp)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-3xl font-bold tracking-tight text-brand">
                {priceLabel(
                  {
                    priceOnRequest: product.priceOnRequest,
                    offerPrice: product.price,
                  },
                  money,
                )}
              </span>
              {product.price !== null && (
                <span className="text-sm text-slate-500">/ unit</span>
              )}
              {product.mrp !== null && (
                <span className="text-sm text-slate-400 line-through">
                  {money(product.mrp)}
                </span>
              )}
              {discount > 0 && (
                <span className="rounded bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {discount}% off MRP
                </span>
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            * Prices are inclusive of GST. Logistics charges are quoted
            separately.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Min purchase order
              </p>
              <p className="mt-1.5 text-lg font-bold text-brand">
                <span className="whitespace-nowrap">
                  {product.moq.toLocaleString("en-IN")}&nbsp;units
                </span>
              </p>
            </div>
            {/* <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Available stock
              </p>
              <p className="mt-1.5 text-lg font-bold text-brand">
                {product.quantity.toLocaleString("en-IN")} units
              </p>
            </div> */}
          </div>

          <ProductActions
            catalogueId={catalogue.id}
            catalogueSlug={slug}
            product={product}
            whatsappNumber={catalogue.whatsappNumber}
          />

          {hasDescription && (
            <section className="mt-8 overflow-hidden rounded-xl border border-slate-200">
              <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-brand">
                About this product
              </h2>
              <div className="space-y-2 px-4 py-3.5 text-sm leading-6 text-slate-600">
                <RichTextContent value={product.description} />
              </div>
            </section>
          )}

          {primarySpecs.length > 0 && (
            <section
              className={`${hasDescription ? "mt-4" : "mt-8"} overflow-hidden rounded-xl border border-slate-200`}
            >
              <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-brand">
                Product specification
              </h2>
              <dl className="divide-y divide-slate-100">
                {primarySpecs.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm odd:bg-slate-50/70"
                  >
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="text-right font-medium text-brand">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {extraSpecs.length > 0 && (
            <details className="group mt-4 overflow-hidden rounded-xl border border-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
                Additional details
                <span className="text-xs font-semibold text-slate-500 group-open:hidden">
                  Show
                </span>
                <span className="hidden text-xs font-semibold text-slate-500 group-open:inline">
                  Hide
                </span>
              </summary>
              <dl className="divide-y divide-slate-100 border-t border-slate-200">
                {extraSpecs.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm odd:bg-slate-50/70"
                  >
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="text-right font-medium text-brand">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>
      </main>

      {related.length > 0 && (
        <section className="border-t border-slate-200 bg-[#f7f8fa]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="mb-5 flex items-end justify-between gap-3">
              <h2 className="text-base md:text-xl font-semibold tracking-[-0.02em] text-brand">
                More from this catalogue
              </h2>
              <Link
                href={`/catalogue/${slug}`}
                className="shrink-0 text-xs md:text-sm font-medium text-brand hover:underline"
              >
                View all {data.products.length}{" "}
                {data.products.length === 1 ? "product" : "products"}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {related.map((item) => {
                const itemDiscount = discountOf(item);
                return (
                  <Link
                    key={item.id}
                    href={`/catalogue/${slug}/product/${item.id}`}
                    className="focus-ring group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-5/4 overflow-hidden bg-[#f2f3f5]">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {item.brand ?? " "}
                      </p>
                      <h3 className="mt-1 truncate text-sm font-semibold text-brand">
                        {item.name}
                      </h3>
                      <div className="mt-2 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1">
                        {item.priceOnRequest ? (
                          <>
                            <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                              <IconTag className="size-3.5 shrink-0" />
                              <span className="truncate">
                                {PRICE_ON_REQUEST_LABEL}
                              </span>
                            </span>
                            {item.mrp !== null && (
                              <span className="text-xs text-slate-400">
                                MRP{" "}
                                <span className="line-through">
                                  {money(item.mrp)}
                                </span>
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-base font-bold tracking-tight text-brand">
                              {priceLabel(
                                {
                                  priceOnRequest: item.priceOnRequest,
                                  offerPrice: item.price,
                                },
                                money,
                              )}
                            </span>
                            {item.mrp !== null && (
                              <span className="text-xs text-slate-400 line-through">
                                {money(item.mrp)}
                              </span>
                            )}
                            {itemDiscount > 0 && (
                              <span className="rounded bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {itemDiscount}% off
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Minimum Order Quantity:{" "}
                        <span className="inline-block whitespace-nowrap">
                          {item.moq.toLocaleString("en-IN")}&nbsp;units
                        </span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        <Check className="mr-1.5 inline size-4 text-emerald-600" /> Verified
        catalogue by Surpluss
      </div>
      <SiteFooter
        whatsappNumber={catalogue.whatsappNumber}
        catalogueTitle={catalogue.title}
      />
      {/* Keeps the floating Contact Supplier bar from covering the footer on phones. */}
      <div aria-hidden className="h-28 sm:hidden" />
    </div>
  );
}
