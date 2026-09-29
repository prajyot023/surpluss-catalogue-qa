"use client";

import { useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";
import { ContactUsButton } from "@/components/catalogue/contact-us-button";
import { waHref, WhatsAppIcon } from "@/components/catalogue/whatsapp-cta";
import { PRICE_ON_REQUEST_CTA_LABEL } from "@/lib/pricing";
import { cn, money } from "@/lib/utils";

const noop = () => {};
const subscribeToNothing = () => noop;

export function productWhatsAppMessage({
  name,
  price,
  url,
}: {
  name: string;
  price: number | null;
  url: string;
}) {
  return [
    "Hi, I am interested in this product:",
    "",
    `Product: ${name}`,
    price !== null ? `Price: ${money(price)}` : "Price on enquiry",
    `Product Link: ${url}`,
  ].join("\n");
}

export function ProductCtaRow({
  product,
  productPath,
  whatsappNumber,
  linkLocation,
  onContact,
  className,
  buttonClassName,
}: {
  product: {
    id: string;
    name: string;
    price: number | null;
    priceOnRequest: boolean;
  };
  productPath: string;
  whatsappNumber: string | null;
  linkLocation: "product_card" | "product_page";
  onContact: () => void;
  className?: string;
  buttonClassName?: string;
}) {
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );

  const href = waHref(
    whatsappNumber,
    productWhatsAppMessage({
      name: product.name,
      price: product.price,
      url: `${origin}${productPath}`,
    }),
  );

  return (
    <div className={cn("@container", className)}>
      <div className="flex items-stretch gap-2">
        {/* The card has limited width and already leads with the price state,
            so the contact CTA only renders on the product page. */}
        {linkLocation === "product_page" && (
          <ContactUsButton
            onClick={onContact}
            label={product.priceOnRequest ? PRICE_ON_REQUEST_CTA_LABEL : undefined}
            className={cn("flex-3", buttonClassName)}
          />
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Contact about ${product.name} on WhatsApp`}
            onClick={() =>
              trackEvent("contact_supplier_whatsapp_click", {
                link_location: linkLocation,
                item_id: product.id,
                item_name: product.name,
              })
            }
            className={cn(
              "focus-ring flex h-10 w-full flex-2 items-center justify-center gap-3 rounded-lg bg-whatsapp text-white transition-colors hover:bg-whatsapp-hover",
              buttonClassName,
            )}
          >
            <WhatsAppIcon className="size-4.5" />
            Whatsapp Us
          </a>
        )}
      </div>
    </div>
  );
}
