-- 1. Snapshot product details onto enquiry items so lead history survives
--    listing removal and later price changes.
ALTER TABLE "enquiry_items"
  ADD COLUMN "product_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "product_sku" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "product_brand" TEXT,
  ADD COLUMN "unit_price" DECIMAL(14,2);

UPDATE "enquiry_items" ei
SET "product_name"  = p."name",
    "product_sku"   = p."sku",
    "product_brand" = p."brand",
    "unit_price"    = p."offer_price"
FROM "catalogue_listings" cl
JOIN "products" p ON p."id" = cl."product_id"
WHERE cl."id" = ei."catalogue_listing_id";

-- 2. Listings can now always be removed: the enquiry item keeps its snapshot
--    and simply loses the link.
ALTER TABLE "enquiry_items" ALTER COLUMN "catalogue_listing_id" DROP NOT NULL;
ALTER TABLE "enquiry_items" DROP CONSTRAINT "enquiry_items_catalogue_listing_id_fkey";
ALTER TABLE "enquiry_items"
  ADD CONSTRAINT "enquiry_items_catalogue_listing_id_fkey"
  FOREIGN KEY ("catalogue_listing_id") REFERENCES "catalogue_listings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Two statuses only: previously inactive catalogues become drafts.
UPDATE "catalogues" SET "status" = 'draft' WHERE "status" = 'inactive';
