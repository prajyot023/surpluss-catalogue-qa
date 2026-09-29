"use client";

import { Copy } from "lucide-react";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({
  slug,
  compact = false,
  variant = "ghost",
  size = "icon-sm",
}: {
  slug: string;
  compact?: boolean;
  variant?: "ghost" | "outline";
  size?: "icon-sm" | "icon";
}) {
  async function copy() {
    const url = `${window.location.origin}/catalogue/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      appToast.success("Catalogue link copied", "Ready to paste into WhatsApp, email or a message.");
    } catch {
      appToast.error("Couldn’t copy the link", "Please copy it from the address bar.");
    }
  }
  if (compact) return <button onClick={copy} className="rounded p-1 transition hover:bg-slate-100" aria-label="Copy catalogue link"><Copy size={12} /></button>;
  return <Button onClick={copy} variant={variant} size={size} aria-label="Copy link"><Copy /></Button>;
}

