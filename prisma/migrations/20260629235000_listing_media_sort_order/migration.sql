-- AlterTable
ALTER TABLE "ListingMedia" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill order using current creation sequence
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "listingId" ORDER BY "createdAt", id) - 1 AS rn
  FROM "ListingMedia"
)
UPDATE "ListingMedia" lm
SET "sortOrder" = ranked.rn
FROM ranked
WHERE lm.id = ranked.id;

-- CreateIndex
CREATE INDEX "ListingMedia_listingId_sortOrder_idx" ON "ListingMedia"("listingId", "sortOrder");
