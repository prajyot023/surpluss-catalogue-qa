import { ArrowLeft, Building2, CalendarDays, Mail, MapPin, MessageCircle, Package, Phone, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/admin/page-header";
import { LeadActions } from "@/components/admin/lead-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, currencySymbol } from "@/lib/utils";
import { getPrisma } from "@/lib/prisma";
import { ShareLeadButton } from "@/components/admin/share-lead-button";

const statusStyles = {
  new: "border-amber-200 bg-amber-50 text-amber-700",
  contacted: "border-blue-200 bg-blue-50 text-blue-700",
  qualified: "border-violet-200 bg-violet-50 text-violet-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-slate-200 bg-slate-50 text-slate-600",
  spam: "border-red-200 bg-red-50 text-red-700",
};

export default async function LeadDetailPage({ params }: PageProps<"/admin/leads/[reference]">) {
  await connection();
  const { reference } = await params;
  const enquiry = await getPrisma().enquiry.findUnique({
    where: { reference },
    include: {
      catalogue: { select: { name: true, slug: true } },
      items: {
        include: {
          catalogueListing: {
            select: {
              productId: true,
            },
          },
        },
      },
    },
  });
  if (!enquiry) notFound();

  const fullPhone = enquiry.phone ? `${enquiry.phoneCountryCode}${enquiry.phone}` : "";
  const whatsappPhone = fullPhone.replace(/\D/g, "");
  const statusLabel = enquiry.status.charAt(0).toUpperCase() + enquiry.status.slice(1);

  return (
    <>
      <PageHeader
        title={enquiry.reference}
        description={`Enquiry from ${enquiry.buyerName} for ${enquiry.catalogue.name}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/leads"
              className={buttonVariants({ variant: "outline" })}
            >
              <ArrowLeft />
              All leads
            </Link>
        
            <ShareLeadButton
              reference={enquiry.reference}
              buyerName={enquiry.buyerName}
              company={enquiry.company}
              phone={fullPhone}
              email={enquiry.email}
              catalogueName={enquiry.catalogue.name}
              totalQuantity={enquiry.items.reduce(
                (total, item) => total + item.requestedQuantity,
                0,
              )}
              status={statusLabel}
              products={enquiry.items.map((item) => ({
                name: item.productName || "Product",
                quantity: item.requestedQuantity,
              }))}
            />
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold">Requested products</h2>
                <p className="mt-0.5 text-xs text-slate-500">{enquiry.catalogue.name}</p>
              </div>
              <Badge variant="outline" className={statusStyles[enquiry.status]}>{statusLabel}</Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {enquiry.items.map((item) => (
                <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_110px_120px] sm:items-center">
                  <div>
                  {item.catalogueListing?.productId ? (
                    <Link
                      href={`/admin/products?view=${item.catalogueListing.productId}`}
                      className="font-medium hover:underline"
                    >
                      {item.productName || "Product"} ↗
                    </Link>
                  ) : (
                    <p className="font-medium">{item.productName || "Product"}</p>
                  )}
                    <p className="mt-1 text-xs text-slate-500">{[item.productBrand, item.productSku].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div><p className="text-xs text-slate-500">Quantity</p><p className="mt-1 font-semibold">{item.requestedQuantity.toLocaleString("en-IN")} units</p></div>
                  <div>
                    <p className="text-xs text-slate-500">Price at enquiry</p>
                    <p className="mt-1 font-semibold">
                      {item.unitPrice ? `${currencySymbol()}${Number(item.unitPrice).toLocaleString("en-IN")}` : "On enquiry"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Buyer details</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex gap-3"><User className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Name</dt><dd className="mt-0.5 font-medium">{enquiry.buyerName}</dd></div></div>
              <div className="flex gap-3"><Building2 className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Company</dt><dd className="mt-0.5 font-medium">{enquiry.company || "Not provided"}</dd></div></div>
              <div className="flex gap-3"><Phone className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">WhatsApp</dt><dd className="mt-0.5 font-medium">{fullPhone || "Not provided"}</dd></div></div>
              <div className="flex gap-3"><Mail className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-0.5 break-all font-medium">{enquiry.email || "Not provided"}</dd></div></div>
              <div className="flex gap-3"><MapPin className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Location</dt><dd className="mt-0.5 font-medium">{enquiry.location || "Not provided"}</dd></div></div>
              <div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Received</dt><dd className="mt-0.5 font-medium">{enquiry.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</dd></div></div>
              <div className="flex gap-3"><UserPlus className="mt-0.5 size-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Referral Person</dt><dd className="mt-0.5 font-medium">{enquiry.referralPerson || "Not provided"}</dd></div></div>
            </dl>
            <div className="mt-6 grid gap-2">
              {whatsappPhone && <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" className={cn(buttonVariants(), "bg-brand text-white")}><MessageCircle /> Open WhatsApp</a>}
              {enquiry.email && <a href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Your Surpluss enquiry ${enquiry.reference}`)}`} className={buttonVariants({ variant: "outline" })}><Mail /> Send email</a>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><Package className="size-4 text-slate-400" /><h2 className="font-semibold">Campaign</h2></div>
            <p className="mt-3 text-sm font-medium">{enquiry.catalogue.name}</p>
            <Link href={`/catalogue/${enquiry.catalogue.slug}`} target="_blank" className={cn(buttonVariants({ variant: "link" }), "mt-1 h-auto p-0 text-xs")}>Open catalogue ↗</Link>
          </section>

          <LeadActions reference={enquiry.reference} status={enquiry.status} internalNotes={enquiry.internalNotes} />
        </aside>
      </div>
    </>
  );
}
