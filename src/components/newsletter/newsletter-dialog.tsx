"use client";

import { IconMail } from "@tabler/icons-react";
import { NewsletterForm } from "@/components/newsletter/newsletter-form";
import type { NewsletterSource } from "@/lib/schemas/newsletter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Subscription dialog opened by the header CTA and the mobile menu item. */
export function NewsletterDialog({
  open,
  onOpenChange,
  source = "header",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: NewsletterSource;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-6 sm:max-w-md">
        <DialogHeader className="gap-3 text-left">
          <div className="grid size-11 place-items-center rounded-full bg-brand/5 text-brand">
            <IconMail className="size-5.5" />
          </div>
          <DialogTitle className="text-lg leading-snug font-semibold tracking-tight text-brand">
            Get daily deals in your inbox
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-500">
            Subscribe to our email list and be the first to hear about new
            surplus deals. Unsubscribe any time.
          </DialogDescription>
        </DialogHeader>
        <NewsletterForm source={source} layout="stacked" className="mt-5" />
      </DialogContent>
    </Dialog>
  );
}
