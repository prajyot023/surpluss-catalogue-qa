import { describe, expect, it } from "vitest";
import { discountPercent, needsPricesForSale, NO_PRICE_LABEL, PRICE_ON_REQUEST_LABEL, priceLabel } from "@/lib/pricing";

// These three functions decide what a buyer is told about price: the "% off"
// badge, the price text, and whether a product is complete enough to go live.

const format = (value: number) => `Rs ${value}`;

describe("discountPercent", () => {
  it("works out the discount from MRP and offer price (seeded trolley: 5999 -> 2499)", () => {
    // 1 - 2499/5999 = 0.5834 -> 58%
    expect(discountPercent({ priceOnRequest: false, mrp: 5999, offerPrice: 2499 })).toBe(58);
  });

  it("claims no discount for a price-on-request product, even if prices are stored", () => {
    expect(discountPercent({ priceOnRequest: true, mrp: 5999, offerPrice: 2499 })).toBe(0);
  });

  it("claims no discount when either price is missing", () => {
    expect(discountPercent({ priceOnRequest: false, mrp: null, offerPrice: 2499 })).toBe(0);
    expect(discountPercent({ priceOnRequest: false, mrp: 5999, offerPrice: null })).toBe(0);
  });

  it("never claims a positive discount when the offer price is at or above MRP", () => {
    expect(discountPercent({ priceOnRequest: false, mrp: 1000, offerPrice: 1000 })).toBe(0);
    expect(discountPercent({ priceOnRequest: false, mrp: 1000, offerPrice: 1200 })).toBeLessThanOrEqual(0);
  });
});

describe("priceLabel", () => {
  it("hides the number for a price-on-request product", () => {
    expect(priceLabel({ priceOnRequest: true, offerPrice: 2499 }, format)).toBe(PRICE_ON_REQUEST_LABEL);
  });

  it("formats the offer price when there is one", () => {
    expect(priceLabel({ priceOnRequest: false, offerPrice: 2499 }, format)).toBe("Rs 2499");
  });

  it("shows a zero price as a price, not as 'on enquiry'", () => {
    expect(priceLabel({ priceOnRequest: false, offerPrice: 0 }, format)).toBe("Rs 0");
  });

  it("falls back to the 'on enquiry' text when no offer price is set", () => {
    expect(priceLabel({ priceOnRequest: false, offerPrice: null }, format)).toBe(NO_PRICE_LABEL);
  });
});

describe("needsPricesForSale", () => {
  it("asks for prices when MRP or offer price is missing", () => {
    expect(needsPricesForSale({ priceOnRequest: false, mrp: null, offerPrice: 100 })).toBe(true);
    expect(needsPricesForSale({ priceOnRequest: false, mrp: 100, offerPrice: null })).toBe(true);
  });

  it("is satisfied when both prices are set, or the product is price-on-request", () => {
    expect(needsPricesForSale({ priceOnRequest: false, mrp: 100, offerPrice: 80 })).toBe(false);
    expect(needsPricesForSale({ priceOnRequest: true, mrp: null, offerPrice: null })).toBe(false);
  });
});
