"use client";

import { useEffect } from "react";
import { productToItem, trackEcommerce } from "@/lib/analytics";

/** Fires the GA4 view_item event once per product page visit. Rendered by the
 * server product page, which cannot push to the dataLayer itself. */
export function ProductViewTracker({
  product,
  listId,
}: {
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    price: number | null;
  };
  listId: string;
}) {
  useEffect(() => {
    trackEcommerce(
      "view_item",
      {
        currency: "INR",
        ...(product.price !== null ? { value: product.price } : {}),
        items: [productToItem(product)],
      },
      { item_list_id: listId },
    );
    // Refire only when the product actually changes, not on rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  return null;
}
