"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";
import { getLastCatalogue } from "@/lib/last-catalogue";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Links to the catalogue the visitor last opened. Until one is known (or when
 * storage is empty), falls back to the WhatsApp access request link.
 */
export function CatalogueLink({
  fallbackHref,
  className,
  children,
  onClick,
  trackLocation,
}: {
  fallbackHref: string | null;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  /** When set, clicks fire browse_catalogue_click with this link_location. */
  trackLocation?: string;
}) {
  const catalogueHref = useSyncExternalStore(
    subscribe,
    getLastCatalogue,
    () => null,
  );

  function handleClick(target: "catalogue" | "whatsapp_fallback") {
    if (trackLocation) {
      trackEvent("browse_catalogue_click", {
        link_location: trackLocation,
        link_target: target,
      });
    }
    onClick?.();
  }

  if (catalogueHref) {
    return (
      <Link
        href={catalogueHref}
        className={className}
        onClick={() => handleClick("catalogue")}
      >
        {children}
      </Link>
    );
  }
  if (!fallbackHref) return null;
  return (
    <a
      href={fallbackHref}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => handleClick("whatsapp_fallback")}
    >
      {children}
    </a>
  );
}
