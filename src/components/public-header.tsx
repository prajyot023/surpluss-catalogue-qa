"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { IconMail, IconMenu2, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { CatalogueLink } from "@/components/about/catalogue-link";
import { BrandMark } from "@/components/brand-mark";
import { waHref, WhatsAppIcon } from "@/components/catalogue/whatsapp-cta";
import { NewsletterDialog } from "@/components/newsletter/newsletter-dialog";
import { trackEvent } from "@/lib/analytics";
import { rememberCatalogue } from "@/lib/last-catalogue";

type PublicHeaderProps = {
  activePage: "catalogue" | "about";
  catalogueSlug?: string;
  browseHref?: string | null;
  chatHref?: string | null;
  whatsappNumber?: string | null;
  whatsappMessage?: string;
};

const activeDesktopClass =
  "relative text-base font-semibold text-brand after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-gold";

const inactiveDesktopClass =
  "focus-ring text-base font-semibold text-slate-500 transition-colors hover:text-brand";

const activeMobileClass =
  "flex items-center justify-between rounded-lg px-2 py-3 text-sm font-semibold text-brand";

const inactiveMobileClass =
  "focus-ring flex items-center rounded-lg px-2 py-3 text-sm font-medium text-slate-500 transition-colors hover:text-brand";

export function PublicHeader({
  activePage,
  catalogueSlug,
  browseHref = null,
  chatHref = null,
  whatsappNumber = null,
  whatsappMessage,
}: PublicHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const resolvedChatHref =
    chatHref ??
    (whatsappMessage ? waHref(whatsappNumber, whatsappMessage) : null);

  const trackingLocation = activePage === "about" ? "about_header" : "header";

  useEffect(() => {
    if (activePage === "catalogue" && catalogueSlug) {
      rememberCatalogue(catalogueSlug);
    }
  }, [activePage, catalogueSlug]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="focus-ring -ml-2 grid size-9 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          >
            {menuOpen ? (
              <IconX className="size-5" />
            ) : (
              <IconMenu2 className="size-5" />
            )}
          </button>

          <BrandMark />
        </div>

        {/* Centred nav only appears once the two CTAs on the right leave room
            for it. Between md and lg the absolute centring used to run under
            the Subscribe pill, so both live in the menu until lg instead. */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {activePage === "catalogue" ? (
            <span className={activeDesktopClass}>Catalogue</span>
          ) : (
            <CatalogueLink
              fallbackHref={browseHref}
              trackLocation="about_header"
              className={inactiveDesktopClass}
            >
              Catalogue
            </CatalogueLink>
          )}

          {activePage === "about" ? (
            <span className={activeDesktopClass}>About Surpluss</span>
          ) : (
            <Link href="/" className={inactiveDesktopClass}>
              About Surpluss
            </Link>
          )}
        </nav>

        {/* Email subscription CTA, immediately left of the WhatsApp CTA.
            `ml-auto` collapses the justify-between gap so both CTAs sit
            together on the right, leaving the WhatsApp anchor below untouched. */}
        <button
          type="button"
          onClick={() => setSubscribeOpen(true)}
          className="focus-ring ml-auto hidden h-9 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-brand transition-colors hover:bg-slate-50 lg:inline-flex"
        >
          <IconMail className="size-4.5 shrink-0 text-brand/60" />
          {/* Below xl the full sentence would crowd the centred nav. */}
          <span className="hidden xl:inline">
            Subscribe to Get Daily Deals update
          </span>
          <span className="xl:hidden">Subscribe</span>
        </button>

        {resolvedChatHref && (
          <a
            href={resolvedChatHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("whatsapp_click", {
                link_location: trackingLocation,
              })
            }
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-brand transition-colors hover:bg-slate-50 sm:w-auto sm:px-4"
          >
            <WhatsAppIcon className="size-4.5 shrink-0 text-whatsapp" />
            <span className="hidden sm:inline">WhatsApp Us</span>
            <span className="sr-only sm:hidden">Contact us on WhatsApp</span>
          </a>
        )}
      </div>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.nav
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-200 lg:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
              {activePage === "catalogue" ? (
                <span className={activeMobileClass}>
                  Catalogue
                  <span className="h-0.5 w-5 rounded-full bg-gold" />
                </span>
              ) : (
                <CatalogueLink
                  fallbackHref={browseHref}
                  trackLocation="about_header"
                  onClick={closeMenu}
                  className={inactiveMobileClass}
                >
                  Catalogue
                </CatalogueLink>
              )}

              {activePage === "about" ? (
                <span className={activeMobileClass}>
                  About Surpluss
                  <span className="h-0.5 w-5 rounded-full bg-gold" />
                </span>
              ) : (
                <Link
                  href="/"
                  onClick={closeMenu}
                  className={inactiveMobileClass}
                >
                  About Surpluss
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  setSubscribeOpen(true);
                }}
                className={`${inactiveMobileClass} w-full gap-2.5 text-left`}
              >
                <IconMail className="size-4.5 shrink-0 text-slate-400" />
                Subscribe to Get Daily Deals update
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <NewsletterDialog
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        source="header"
      />
    </header>
  );
}
