export type EffectiveCatalogueStatus = "draft" | "published" | "expired";

/** The status to show. The app works with two states, draft and live:
 * legacy "inactive" rows read as draft, and a published catalogue whose
 * validity date has passed reads as expired. */
export function effectiveStatus(
  status: "draft" | "published" | "inactive" | "expired",
  expiresAt: Date | null,
): EffectiveCatalogueStatus {
  if (status === "published" && expiresAt && expiresAt > new Date()) return "expired";
  if (status === "inactive" || status === "expired") return "draft";
  return status;
}
