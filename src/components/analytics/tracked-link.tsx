"use client";

import type { ComponentProps } from "react";
import { trackEvent } from "@/lib/analytics";

/** Anchor that pushes a GTM event on click. Lets server components (footer,
 * about page) attach tracking without becoming client components. */
export function TrackedLink({
  event,
  params,
  onClick,
  ...props
}: ComponentProps<"a"> & {
  event: string;
  params?: Record<string, unknown>;
}) {
  return (
    <a
      {...props}
      onClick={(e) => {
        trackEvent(event, params);
        onClick?.(e);
      }}
    />
  );
}
