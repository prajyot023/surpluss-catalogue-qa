"use client";

import { useState } from "react";
import { Link2, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ContactSupplierDialog } from "@/components/catalogue/contact-supplier-dialog";
import { ProductCtaRow } from "@/components/catalogue/product-cta-row";
import type { ProductView } from "@/lib/catalogue-queries";
import { appToast } from "@/components/ui/app-toast";

export function ProductActions({
  catalogueId,
  catalogueSlug,
  product,
  whatsappNumber,
}: {
  catalogueId: string;
  catalogueSlug: string;
  product: ProductView;
  whatsappNumber: string | null;
}) {
  const [contacting, setContacting] = useState(false);
  const productPath = `/catalogue/${catalogueSlug}/product/${product.id}`;

  function openContact() {
    trackEvent("contact_supplier_click", {
      link_location: "product_page",
      item_id: product.id,
      item_name: product.name,
    });
    setContacting(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      trackEvent("share", {
        method: "copy_link",
        content_type: "product",
        item_id: product.id,
        link_location: "product_page",
      });
      appToast.success("Link copied", "Share it with your team.");
    } catch {
      appToast.error(
        "Could not copy the link",
        "Copy it from the address bar instead.",
      );
    }
  }

  return (
    <>
      {/* Desktop keeps the CTA, copy link and trust note inline. On phones the
          CTA lives in the fixed bar below and sharing happens from the photo,
          so nothing renders here. */}
      <div className="mt-7 hidden sm:block">
        <ProductCtaRow
          product={product}
          productPath={productPath}
          whatsappNumber={whatsappNumber}
          linkLocation="product_page"
          onContact={openContact}
          buttonClassName="h-12 rounded-xl text-sm"
        />
        <div className="mt-5 border-t border-slate-200 pt-4">
          <button
            onClick={copyLink}
            className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-brand"
          >
            <Link2 className="size-4" />
            Copy link
          </button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="size-4 shrink-0" />
          Handled directly by the Surpluss team. We reply within 24 hours.
        </p>
      </div>

      {/* On phones the button floats above the fold so it is always one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <ProductCtaRow
          product={product}
          productPath={productPath}
          whatsappNumber={whatsappNumber}
          linkLocation="product_page"
          onContact={openContact}
          buttonClassName="h-12 rounded-xl text-sm"
        />
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="size-3.5 shrink-0" />
          Handled directly by the Surpluss team. We reply within 24 hours.
        </p>
      </div>

      {contacting && (
        <ContactSupplierDialog
          key={product.id}
          catalogueId={catalogueId}
          product={product}
          whatsappNumber={whatsappNumber}
          onClose={() => setContacting(false)}
        />
      )}
    </>
  );
}
