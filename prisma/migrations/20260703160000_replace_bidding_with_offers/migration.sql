-- The site never processes item payments, so "buy now" was misleading.
-- Listings now take open offers: the price becomes an optional "asking price",
-- bidding opt-in fields go away, and Bid becomes Offer with an acceptance
-- timestamp the seller sets to close the deal.

-- Listing: buy-now price becomes optional asking price; bidding fields replaced by an offer deadline
ALTER TABLE "Listing" RENAME COLUMN "buyNowPrice" TO "askingPrice";
ALTER TABLE "Listing" ALTER COLUMN "askingPrice" DROP NOT NULL;
ALTER TABLE "Listing" RENAME COLUMN "bidEndAt" TO "offerEndAt";
ALTER TABLE "Listing" DROP COLUMN "biddingEnabled";
ALTER TABLE "Listing" DROP COLUMN "minBid";

-- Bid becomes Offer with an acceptedAt timestamp
ALTER TABLE "Bid" RENAME TO "Offer";
ALTER TABLE "Offer" RENAME COLUMN "bidderId" TO "buyerId";
ALTER TABLE "Offer" ADD COLUMN "acceptedAt" TIMESTAMP(3);

-- Rename constraints/indexes to the names Prisma expects for the new model,
-- so future `migrate diff` runs don't report drift
ALTER TABLE "Offer" RENAME CONSTRAINT "Bid_pkey" TO "Offer_pkey";
ALTER TABLE "Offer" RENAME CONSTRAINT "Bid_listingId_fkey" TO "Offer_listingId_fkey";
ALTER TABLE "Offer" RENAME CONSTRAINT "Bid_bidderId_fkey" TO "Offer_buyerId_fkey";
ALTER INDEX "Bid_listingId_idx" RENAME TO "Offer_listingId_idx";
