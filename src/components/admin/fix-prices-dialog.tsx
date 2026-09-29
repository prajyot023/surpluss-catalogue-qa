"use client";

import { useState } from "react";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { completeProductsForSale } from "@/app/admin/products/actions";
import { PRICE_ON_REQUEST_LABEL } from "@/lib/pricing";
import type { IncompleteProduct } from "@/lib/schemas/product";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type SaleDraft = { mrp: string; offerPrice: string; quantity: string };

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function parseStock(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function draftFor(product: IncompleteProduct, drafts: Record<string, SaleDraft>): SaleDraft {
  return (
    drafts[product.id] ?? {
      mrp: product.mrp !== null ? String(product.mrp) : "",
      offerPrice: product.offerPrice !== null ? String(product.offerPrice) : "",
      quantity: product.quantity > 0 ? String(product.quantity) : "",
    }
  );
}

/** Rows of MRP, offer price and stock inputs for products that block publishing.
 * Shared by the publish gate dialog and the catalogue create flow. */
export function PriceFixRows({
  products,
  drafts,
  onDraftChange,
}: {
  products: IncompleteProduct[];
  drafts: Record<string, SaleDraft>;
  onDraftChange: (id: string, draft: SaleDraft) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_76px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Product</span>
        <span>MRP (₹)</span>
        <span>Offer (₹)</span>
        <span>Stock</span>
      </div>
      {products.map((product, index) => {
        const draft = draftFor(product, drafts);
        return (
          <motion.div
            key={product.id}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.25) }}
            className="grid grid-cols-[minmax(0,1fr)_88px_88px_76px] items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="truncate font-mono text-xs text-slate-500">{product.sku}</p>
            </div>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.mrp}
              onChange={(event) => onDraftChange(product.id, { ...draft, mrp: event.target.value })}
              className="h-8 px-2 text-sm tabular-nums"
              placeholder="Add"
              aria-label={`MRP for ${product.name}`}
            />
            {product.priceOnRequest ? (
              <span className="truncate text-xs text-slate-500">{PRICE_ON_REQUEST_LABEL}</span>
            ) : (
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.offerPrice}
                onChange={(event) => onDraftChange(product.id, { ...draft, offerPrice: event.target.value })}
                className="h-8 px-2 text-sm tabular-nums"
                placeholder="Add"
                aria-label={`Offer price for ${product.name}`}
              />
            )}
            <Input
              type="number"
              min={1}
              step={1}
              value={draft.quantity}
              onChange={(event) => onDraftChange(product.id, { ...draft, quantity: event.target.value })}
              className="h-8 px-2 text-sm tabular-nums"
              placeholder="Add"
              aria-label={`Stock for ${product.name}`}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

export function buildSaleUpdates(products: IncompleteProduct[], drafts: Record<string, SaleDraft>) {
  const updates: { id: string; mrp: number | null; offerPrice: number | null; quantity: number }[] =
    [];
  let incomplete = false;
  for (const product of products) {
    const draft = draftFor(product, drafts);
    const mrp = parseMoney(draft.mrp);
    const offerPrice = product.priceOnRequest ? null : parseMoney(draft.offerPrice);
    const quantity = parseStock(draft.quantity);
    if (quantity === null || (!product.priceOnRequest && (mrp === null || offerPrice === null))) {
      incomplete = true;
      continue;
    }
    updates.push({ id: product.id, mrp, offerPrice, quantity });
  }
  return { updates, incomplete };
}

/** Blocks publishing while products are missing prices or stock; lets the user
 * fill them in right here and publish in one go, or fall back to a draft. */
export function FixPricesDialog({
  products,
  onClose,
  onSaveDraft,
  onPublish,
}: {
  products: IncompleteProduct[];
  onClose: () => void;
  /** Called when the user chooses to keep the catalogue as a draft. */
  onSaveDraft: () => void | Promise<void>;
  /** Called after the details are saved; should retry the publish. */
  onPublish: () => void | Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, SaleDraft>>({});
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  async function saveAndPublish() {
    const { updates, incomplete } = buildSaleUpdates(products, drafts);
    if (incomplete) {
      appToast.error(
        "Some details are missing",
        "Every product needs MRP, offer price and a stock quantity above 0.",
      );
      return;
    }
    setBusy("publish");
    try {
      const result = await completeProductsForSale(updates);
      if ("error" in result) {
        appToast.error("Could not save the details", result.error);
        return;
      }
      await onPublish();
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    setBusy("draft");
    try {
      await onSaveDraft();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconAlertTriangle className="size-5 text-amber-500" /> Almost there
          </DialogTitle>
          <DialogDescription>
            {products.length === 1
              ? "1 product needs prices and stock before this catalogue can go live. Add them below."
              : `${products.length} products need prices and stock before this catalogue can go live. Add them below.`}
          </DialogDescription>
        </DialogHeader>
        <PriceFixRows
          products={products}
          drafts={drafts}
          onDraftChange={(id, draft) => setDrafts((current) => ({ ...current, [id]: draft }))}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={saveDraft} disabled={busy !== null}>
            {busy === "draft" ? <><IconLoader2 className="animate-spin" /> Saving…</> : "Keep as draft"}
          </Button>
          <Button
            type="button"
            onClick={saveAndPublish}
            disabled={busy !== null}
            className="bg-brand text-white"
          >
            {busy === "publish" ? <><IconLoader2 className="animate-spin" /> Publishing…</> : "Save details and publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
