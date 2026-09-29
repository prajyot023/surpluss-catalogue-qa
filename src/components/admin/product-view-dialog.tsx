"use client";

import Image from "next/image";
import { useState } from "react";
import {
  IconAlertTriangle,
  IconBook2,
  IconMapPin,
  IconPackage,
  IconPencil,
  IconPhotoOff,
  IconStack2,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import type { AdminProductRow } from "@/components/admin/products-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { discountPercent, needsPricesForSale, PRICE_ON_REQUEST_LABEL } from "@/lib/pricing";
import { hasRichTextContent, richTextToPlainText } from "@/lib/rich-text";
import { cn, money } from "@/lib/utils";

// Rendered only while open, keyed by product id, so the gallery resets between products.
export function ProductViewDialog({
  product,
  onClose,
  onEdit,
}: {
  product: AdminProductRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [activeImage, setActiveImage] = useState(0);
  const discount = discountPercent(product);
  const missingPrice = needsPricesForSale(product);
  const attributes = Object.entries(product.attributes);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="pr-8">{product.name}</DialogTitle>
          <DialogDescription>
            {[product.brand, product.sku, product.category].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 sm:grid-cols-[300px_minmax(0,1fr)]">
            <div>
              <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {product.images[activeImage] ? (
                  <motion.div
                    key={activeImage}
                    initial={reducedMotion ? false : { opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={product.images[activeImage]}
                      alt={product.name}
                      fill
                      sizes="300px"
                      className="object-cover"
                    />
                  </motion.div>
                ) : (
                  <div className="grid h-full place-items-center text-slate-300">
                    <div className="text-center">
                      <IconPhotoOff className="mx-auto size-8" />
                      <p className="mt-2 text-xs text-slate-400">No photos yet</p>
                    </div>
                  </div>
                )}
              </div>
              {product.images.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {product.images.map((image, index) => (
                    <button
                      key={image + index}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`Photo ${index + 1}`}
                      className={cn(
                        "relative size-14 shrink-0 overflow-hidden rounded-lg border-2 transition",
                        index === activeImage ? "border-brand" : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      <Image src={image} alt="" fill sizes="56px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0">
              {product.priceOnRequest ? (
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-3xl font-bold tracking-tight text-brand">{PRICE_ON_REQUEST_LABEL}</span>
                  {product.mrp !== null && (
                    <span className="text-sm text-slate-400 line-through">{money(product.mrp)}</span>
                  )}
                </div>
              ) : missingPrice ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  <IconAlertTriangle className="size-3.5" /> Prices not set yet
                </Badge>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-3xl font-bold tracking-tight text-brand">{money(product.offerPrice!)}</span>
                  <span className="text-sm text-slate-400 line-through">{money(product.mrp!)}</span>
                  {discount > 0 && (
                    <span className="rounded bg-gold px-1.5 py-0.5 text-[10px] font-bold text-brand">
                      {discount}% off
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                {[
                  { label: "In stock", value: product.quantity.toLocaleString("en-IN"), icon: IconPackage },
                  { label: "Minimum Order Quantity", value: product.moq.toLocaleString("en-IN"), icon: IconStack2 },
                  { label: "Catalogues", value: String(product.catalogues), icon: IconBook2 },
                ].map((tile) => (
                  <div key={tile.label} className="flex flex-col items-center justify-start gap-1.5 px-2 py-4 text-center">
                    <span className="grid size-8 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
                      <tile.icon className="size-4" />
                    </span>
                    <p className="text-lg font-bold leading-none text-brand">{tile.value}</p>
                    <p className="text-[11px] font-medium leading-tight text-slate-500">{tile.label}</p>
                  </div>
                ))}
              </div>

              {product.stocks.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <IconMapPin className="size-4 text-slate-400" />
                  {product.stocks.map((stock) => (
                    <Badge key={stock.placeId} variant="outline" className="border-slate-200 text-slate-600">
                      {stock.name}
                      <span className="font-bold text-brand">{stock.quantity.toLocaleString("en-IN")}</span>
                    </Badge>
                  ))}
                </div>
              )}

              {hasRichTextContent(product.description) && (
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {richTextToPlainText(product.description)}
                </p>
              )}

              {attributes.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <p className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-brand">Details</p>
                  <dl className="divide-y divide-slate-100">
                    {attributes.map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-4 px-4 py-2 text-sm odd:bg-slate-50/70">
                        <dt className="text-slate-500">{key}</dt>
                        <dd className="text-right font-medium text-brand">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit} className="bg-brand text-white">
            <IconPencil /> Edit product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
