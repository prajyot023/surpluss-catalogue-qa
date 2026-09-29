import type { ListingBadge } from "@/lib/badges";
import { cn } from "@/lib/utils";

/** Promo badges for a product. Overlays the photo by default (parent must be
 * relative); pass inline to render them in normal flow, e.g. above a title. */
export function ProductBadges({
  badges,
  className,
  inline = false,
}: {
  badges: ListingBadge[];
  className?: string;
  inline?: boolean;
}) {
  if (!badges.length) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap",
        inline
          ? "gap-1.5"
          : "pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] gap-1",
        className,
      )}
    >
      {badges.map((badge) => (
        <span
          key={badge.text}
          className={cn(
            "rounded-sm font-medium",
            inline ? "px-3 py-1 text-sm" : "px-2.5 py-1.5 text-xs ",
          )}
          style={{ backgroundColor: badge.bg, color: badge.fg }}
        >
          {badge.text}
        </span>
      ))}
    </div>
  );
}
