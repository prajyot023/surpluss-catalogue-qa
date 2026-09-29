"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { slugify } from "@/lib/slug";

export type SlugCheckStatus = "idle" | "checking" | "available" | "taken";

type CheckResult = {
  slug: string;
  /** null means the check failed; fail open, the save path still enforces uniqueness. */
  available: boolean | null;
};

/** Debounced live check of a catalogue link against the server. Purely a
 * typing aid: the create and update paths still enforce uniqueness. */
export function useSlugCheck(slug: string, excludeId?: string) {
  const clean = slugify(slug);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    if (!clean) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.get<{ available: boolean }>(
          "/api/admin/catalogues/slug-check",
          { params: excludeId ? { slug: clean, excludeId } : { slug: clean } },
        );
        if (!cancelled) setResult({ slug: clean, available: response.data.available });
      } catch {
        if (!cancelled) setResult({ slug: clean, available: null });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clean, excludeId]);

  if (!clean) return "idle" as const;
  if (result?.slug !== clean) return "checking" as const;
  if (result.available === null) return "idle" as const;
  return result.available ? ("available" as const) : ("taken" as const);
}
