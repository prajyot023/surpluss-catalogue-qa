import { z } from "zod";

export const MAX_BADGES_PER_LISTING = 3;
export const BADGE_TEXT_MAX_LENGTH = 18;

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color")
  .transform((value) => value.toLowerCase());

export const badgeTextColorSchema = z.enum(["black", "white"]);
export type BadgeTextColor = z.infer<typeof badgeTextColorSchema>;

export const listingBadgeSchema = z.object({
  text: z.string().trim().min(1, "Badge text is required").max(BADGE_TEXT_MAX_LENGTH),
  bg: hexColorSchema,
  fg: badgeTextColorSchema,
});

export type ListingBadge = z.infer<typeof listingBadgeSchema>;

export const listingBadgesSchema = z
  .array(listingBadgeSchema)
  .max(MAX_BADGES_PER_LISTING)
  .refine(
    (badges) => new Set(badges.map((badge) => badge.text.toLowerCase())).size === badges.length,
    { message: "Each badge needs a different text" },
  );

/** A saved badge from the library, ready to apply to listings. */
export type BadgePresetDto = ListingBadge & { id: string };

/** The curated background colors an admin can pick for a badge. */
export const BADGE_SWATCHES = [
  "#ffde59",
  "#ef4444",
  "#f97316",
  "#059669",
  "#0ea5e9",
  "#7c3aed",
  "#f43f5e",
  "#0b1f3a",
  "#475569",
] as const;

/** Narrows raw badge_presets rows to the DTO, dropping any invalid row. */
export function toBadgePresets(
  records: { id: string; text: string; bg: string; fg: string }[],
): BadgePresetDto[] {
  return records.flatMap((record) => {
    const parsed = listingBadgeSchema.safeParse(record);
    return parsed.success ? [{ id: record.id, ...parsed.data }] : [];
  });
}

// The first version stored badges as { text, color: <preset key> }.
const LEGACY_COLORS: Record<string, { bg: string; fg: BadgeTextColor }> = {
  red: { bg: "#ef4444", fg: "white" },
  orange: { bg: "#f97316", fg: "white" },
  amber: { bg: "#fbbf24", fg: "black" },
  emerald: { bg: "#059669", fg: "white" },
  sky: { bg: "#0ea5e9", fg: "white" },
  violet: { bg: "#7c3aed", fg: "white" },
  rose: { bg: "#f43f5e", fg: "white" },
  navy: { bg: "#0b1f3a", fg: "white" },
  slate: { bg: "#475569", fg: "white" },
};

/** Lenient read of the badges Json column: bad data renders as no badges. */
export function parseListingBadges(value: unknown): ListingBadge[] {
  const source = Array.isArray(value)
    ? value.map((entry) => {
        if (entry && typeof entry === "object" && "color" in entry && !("bg" in entry)) {
          const record = entry as { text?: unknown; color?: unknown };
          const legacy = LEGACY_COLORS[String(record.color)];
          if (legacy) return { text: record.text, ...legacy };
        }
        return entry;
      })
    : value;
  const parsed = listingBadgesSchema.safeParse(source);
  return parsed.success ? parsed.data : [];
}
