import { IconArrowRight, IconMail, IconShieldCheck } from "@tabler/icons-react";
import Link from "next/link";
import { CatalogueLink } from "@/components/about/catalogue-link";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { BrandMark } from "@/components/brand-mark";
import { waHref, WhatsAppIcon } from "@/components/catalogue/whatsapp-cta";
import { NewsletterForm } from "@/components/newsletter/newsletter-form";

const WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/IMbCgVVj1dA7F6Aw1Od2jW";
const CONTACT_EMAIL = "sales@surpluss.co";

const linkClass =
  "focus-ring group inline-flex items-center gap-2.5 text-sm text-white/70 transition-colors hover:text-white";

/* Label with a gold underline that slides in on hover. */
function LinkLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative">
      {children}
      <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-gold transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </span>
  );
}

/** Shared footer for the public catalogue and About Surpluss pages. */
export function SiteFooter({
  whatsappNumber,
  catalogueTitle,
}: {
  whatsappNumber: string | null;
  catalogueTitle?: string;
}) {
  const chatHref = waHref(
    whatsappNumber,
    catalogueTitle
      ? `Hi Surpluss team! I'm browsing the "${catalogueTitle}" catalogue and would like to know more.`
      : "Hi Surpluss team!",
  );
  const accessHref = waHref(
    whatsappNumber,
    "Hi Surpluss team, I’d like access to the catalogue.",
  );

  return (
    <footer className="relative overflow-hidden bg-brand text-white">
      <div className="h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgba(255,255,255,0.07),transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6">
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-12">
          {/* Brand and contact */}
          <div className="md:col-span-5">
            <BrandMark inverse className="opacity-95" />
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/60">
              Connecting businesses with better buying opportunities. Curated
              products and inventory at highly competitive prices.
            </p>
            <ul className="mt-7 space-y-3.5">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                  <IconMail className="size-4 shrink-0 text-white/40 transition-colors group-hover:text-gold" />
                  <LinkLabel>{CONTACT_EMAIL}</LinkLabel>
                </a>
              </li>
              {chatHref && (
                <li>
                  <TrackedLink
                    event="whatsapp_click"
                    params={{ link_location: "footer" }}
                    href={chatHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    <WhatsAppIcon className="size-4 shrink-0 text-white/40 transition-colors group-hover:text-whatsapp" />
                    <LinkLabel>Chat with us on WhatsApp</LinkLabel>
                  </TrackedLink>
                </li>
              )}
            </ul>

            {/* Email list sign-up. Separate from the WhatsApp community card. */}
            <div className="mt-8 max-w-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Email updates
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Get the latest deal updates straight to your inbox.
              </p>
              <NewsletterForm source="footer" tone="dark" className="mt-4" />
            </div>
          </div>

          {/* Explore */}
          <div className="md:col-span-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Explore
            </h3>
            <ul className="mt-5 space-y-3.5">
              <li>
                <CatalogueLink
                  fallbackHref={accessHref}
                  trackLocation="footer"
                  className={linkClass}
                >
                  <LinkLabel>Catalogue</LinkLabel>
                </CatalogueLink>
              </li>
              <li>
                <Link href="/" className={linkClass}>
                  <LinkLabel>About Surpluss</LinkLabel>
                </Link>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                  <LinkLabel>Contact Us</LinkLabel>
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div className="md:col-span-4">
            <div className="group relative overflow-hidden rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 transition-shadow duration-300 hover:ring-whatsapp/30">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-14 -right-14 size-44 rounded-full bg-whatsapp/15 opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              />
              <WhatsAppIcon
                aria-hidden
                className="pointer-events-none absolute -right-5 -bottom-7 size-32 -rotate-12 text-white/4"
              />
              <div className="relative">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-whatsapp" />
                  </span>
                  WhatsApp community
                </p>
                <h3 className="mt-3 text-lg font-semibold tracking-[-0.01em]">
                  Deals drop here first.
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Join 3,000+ buyers and be the first to know when new surplus
                  deals go live.
                </p>
                <TrackedLink
                  event="whatsapp_click"
                  params={{ link_location: "footer_community" }}
                  href={WHATSAPP_COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-whatsapp text-sm font-semibold text-white transition-colors duration-300 hover:bg-whatsapp-hover"
                >
                  <WhatsAppIcon className="size-4.5" />
                  Join the community
                  <IconArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </TrackedLink>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Surpluss. All rights reserved.</p>
          <p className="inline-flex items-center gap-2">
            <IconShieldCheck className="size-4 shrink-0" />
            No payment is collected on this website. An enquiry starts a
            conversation, not an order.
          </p>
        </div>
      </div>

      {/* Oversized wordmark, fading out toward the footer edge */}
      <div aria-hidden className="relative -mt-8 select-none">
        <p className="text-center text-[clamp(4rem,13vw,11rem)] font-bold leading-none tracking-tighter mask-[linear-gradient(to_bottom,black_15%,transparent_88%)]">
          <span className="text-white/6">surplus</span>
          <span className="text-gold/15">s</span>
        </p>
      </div>
    </footer>
  );
}
