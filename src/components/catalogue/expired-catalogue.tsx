import { Hourglass } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter } from "@/components/catalogue/site-footer";
import { waHref, WhatsAppIcon } from "@/components/catalogue/whatsapp-cta";

/** Friendly landing page for shared links whose catalogue validity has passed. */
export function ExpiredCatalogue({ title, whatsappNumber }: { title: string; whatsappNumber: string | null }) {
  const href = waHref(
    whatsappNumber,
    `Hi Surpluss team! The "${title}" catalogue link I have has expired. Could you share your latest deals?`,
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <BrandMark />
        </div>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-gold/25 text-brand">
            <Hourglass className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-brand">This catalogue has expired</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            The deals in &ldquo;{title}&rdquo; are no longer available. Message us and we will send you the latest
            catalogue with current stock and prices.
          </p>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mx-auto mt-6 flex h-11 w-fit items-center gap-2 rounded-full bg-whatsapp px-5 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-hover"
            >
              <WhatsAppIcon className="size-4.5" />
              Get the latest deals on WhatsApp
            </a>
          )}
        </div>
      </main>
      <SiteFooter whatsappNumber={whatsappNumber} catalogueTitle={title} />
    </div>
  );
}
