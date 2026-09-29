export const PRICE_ON_REQUEST_LABEL = "Price on Request";

export const PRICE_ON_REQUEST_SUPPORT_COPY = "Bulk pricing available based on quantity";

export const PRICE_ON_REQUEST_CTA_LABEL = "Get Offer Price";

export const NO_PRICE_LABEL = "Price on enquiry";

export const OFFER_PRICE_REQUIRED_MESSAGE =
  "Offer Price is required unless Price on Request is enabled.";

export type PricingFacts = {
  priceOnRequest: boolean;
  mrp: number | null;
  offerPrice: number | null;
};

export function discountPercent({ priceOnRequest, mrp, offerPrice }: PricingFacts) {
  if (priceOnRequest) return 0;
  if (!mrp || !offerPrice) return 0;
  if (!Number.isFinite(mrp) || !Number.isFinite(offerPrice)) return 0;
  return Math.round((1 - offerPrice / mrp) * 100);
}

export function priceLabel(
  { priceOnRequest, offerPrice }: Pick<PricingFacts, "priceOnRequest" | "offerPrice">,
  format: (value: number) => string,
) {
  if (priceOnRequest) return PRICE_ON_REQUEST_LABEL;
  return offerPrice !== null ? format(offerPrice) : NO_PRICE_LABEL;
}

export function needsPricesForSale({ priceOnRequest, mrp, offerPrice }: PricingFacts) {
  if (priceOnRequest) return false;
  return mrp === null || offerPrice === null;
}
