"use client";

import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import type { SlugCheckStatus } from "@/hooks/use-slug-check";

/** Inline icon for the right edge of a slug input; wrap the input in a
 * relative container. */
export function SlugStatusIcon({ status }: { status: SlugCheckStatus }) {
  if (status === "idle") return null;
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
      {status === "checking" && (
        <IconLoader2 className="size-4 animate-spin text-slate-400" aria-label="Checking the link" />
      )}
      {status === "available" && (
        <IconCheck className="size-4 text-emerald-600" aria-label="Link is available" />
      )}
      {status === "taken" && (
        <IconX className="size-4 text-red-600" aria-label="Link is already in use" />
      )}
    </span>
  );
}

/** One-line verdict under the slug input. */
export function SlugStatusHint({ status }: { status: SlugCheckStatus }) {
  if (status === "available") {
    return <p className="mt-1 text-[11px] text-emerald-600">This link is available.</p>;
  }
  if (status === "taken") {
    return <p className="mt-1 text-[11px] text-red-600">This link is already in use. Pick a different one.</p>;
  }
  return null;
}
