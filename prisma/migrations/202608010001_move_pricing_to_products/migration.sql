-- Move pricing, quantity and MOQ from catalogue_listings to products.
-- Backfill runs before the drops so no data is lost.

ALTER TABLE "products"
  ADD COLUMN "mrp" DECIMAL(14,2),
  ADD COLUMN "offer_price" DECIMAL(14,2),
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "moq" INTEGER NOT NULL DEFAULT 1;

-- Each product takes the values from its most recently updated listing.
UPDATE "products" p
SET "mrp"         = l."mrp",
    "offer_price" = l."offer_price",
    "quantity"    = l."quantity",
    "moq"         = l."moq"
FROM (
  SELECT DISTINCT ON ("product_id") "product_id", "mrp", "offer_price", "quantity", "moq"
  FROM "catalogue_listings"
  ORDER BY "product_id", "updated_at" DESC
) l
WHERE l."product_id" = p."id";

ALTER TABLE "catalogue_listings"
  DROP COLUMN "offer_price",
  DROP COLUMN "mrp",
  DROP COLUMN "pricing_mode",
  DROP COLUMN "quantity",
  DROP COLUMN "moq";

ALTER TABLE "catalogues" DROP COLUMN "pricing_mode";

DROP TYPE "pricing_mode";
