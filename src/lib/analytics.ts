"use client";

import { sendGTMEvent } from "@next/third-parties/google";

/** GA4 item shape used inside the ecommerce object. */
export type GaItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

type ProductLike = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  price: number | null;
};

export function productToItem(product: ProductLike, quantity = 1): GaItem {
  const item: GaItem = {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category,
    quantity,
  };
  if (product.brand) item.item_brand = product.brand;
  if (product.price !== null) item.price = product.price;
  return item;
}

/** Push a flat event. Never pass PII (names, phone numbers) here. */
export function trackEvent(event: string, params?: Record<string, unknown>) {
  sendGTMEvent({ event, ...params });
}

/** Push an ecommerce event. Clears the previous ecommerce object first so
 * GTM does not merge items across events. */
export function trackEcommerce(
  event: string,
  ecommerce: Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  sendGTMEvent({ ecommerce: null });
  sendGTMEvent({ event, ecommerce, ...params });
}

/** Readable promotion name from a banner image URL, for example
 * ".../diwali-sale-70off.webp" becomes "diwali-sale-70off". */
export function promotionNameFromUrl(imageUrl: string) {
  try {
    const path = new URL(imageUrl, "https://placeholder.invalid").pathname;
    const file = decodeURIComponent(path.split("/").pop() ?? "");
    return file.replace(/\.[a-z0-9]+$/i, "") || "banner";
  } catch {
    return "banner";
  }
}
