"use client";

import { Share2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { appToast } from "@/components/ui/app-toast";
import { cn } from "@/lib/utils";

/** Round share button that floats over the product photo on phones. Uses the
 * native share sheet when available and falls back to copying the link. */
export function ShareProductButton({
  title,
  productId,
  className,
}: {
  title: string;
  productId?: string;
  className?: string;
}) {
  function trackShare(method: "native_share" | "copy_link") {
    trackEvent("share", {
      method,
      content_type: "product",
      ...(productId ? { item_id: productId } : {}),
      link_location: "product_photo",
    });
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        trackShare("native_share");
      } catch {
        // User dismissed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      trackShare("copy_link");
      appToast.success("Link copied", "Share it with your team.");
    } catch {
      appToast.error(
        "Could not copy the link",
        "Copy it from the address bar instead.",
      );
    }
  }

  return (
    <button
      type="button"
      aria-label="Share this product"
      onClick={share}
      className={cn(
        "focus-ring grid size-9 place-items-center rounded-full bg-white/90 text-brand shadow-md backdrop-blur transition-colors hover:bg-white",
        className,
      )}
    >
      <Share2 className="size-4.5" />
    </button>
  );
}
