import { Prisma, PrismaClient } from "@prisma/client";
import { prisma, withRetry } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

type DbClient = PrismaClient | Prisma.TransactionClient;

// Premium tier rules:
// - Listings are ordered by sortOrder ascending within a category, so the
//   sortOrder value is the position slot an admin assigns.
// - Position slots 1-10  -> "vip" for the admin-configured VIP duration.
// - Position slots 11-20 -> "top" for the admin-configured Top duration.
// - Everything else (default 1000) carries no premium tier, so small
//   categories don't accidentally promote every ad.
// - When premiumUntil passes, the tier reverts to none and sortOrder resets
//   (handled by the expire cron + activeTier checks on read).

export const VIP_POSITIONS = 10;
export const TOP_POSITIONS = 20;
export const DEFAULT_SORT_ORDER = 1000;

// The position-slot range [start, end] that qualifies for a tier.
export function bandRange(tier: "top" | "vip"): [number, number] {
  return tier === "vip" ? [1, VIP_POSITIONS] : [VIP_POSITIONS + 1, TOP_POSITIONS];
}

// Finds an open position slot in a tier's band for `categoryId`, ignoring
// `excludeId` (the ad being placed). Returns the lowest free slot, or the last
// slot in the band when it's full (ties are broken by featured/recency on read).
export async function findOpenBandSlot(
  db: DbClient,
  categoryId: string,
  tier: "top" | "vip",
  excludeId: string
): Promise<number> {
  const [bandStart, bandEnd] = bandRange(tier);
  const taken = await db.listing.findMany({
    where: {
      categoryId,
      status: "active",
      id: { not: excludeId },
      sortOrder: { gte: bandStart, lte: bandEnd },
    },
    select: { sortOrder: true },
  });
  const used = new Set(taken.map((t) => t.sortOrder));
  for (let slot = bandStart; slot <= bandEnd; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return bandEnd; // band full -> share the last slot
}

// Applies a paid promotion to an ad: places it in the tier's band and sets the
// premium expiry. Buying the same tier again while it's still active extends
// the existing expiry (and keeps the current slot); otherwise the clock starts
// now. Runs on whatever db client is passed (e.g. a capture transaction).
export async function applyPremiumPurchase(
  db: DbClient,
  listing: { id: string; categoryId: string; sortOrder: number } & TierFields,
  tier: "top" | "vip",
  days: number
): Promise<void> {
  const [bandStart, bandEnd] = bandRange(tier);
  const alreadyInBand = listing.sortOrder >= bandStart && listing.sortOrder <= bandEnd;
  const sortOrder = alreadyInBand
    ? listing.sortOrder
    : await findOpenBandSlot(db, listing.categoryId, tier, listing.id);

  const stillActive = activeTier(listing) === tier && listing.premiumUntil;
  const base = stillActive ? new Date(listing.premiumUntil as Date | string).getTime() : Date.now();
  const premiumUntil = new Date(base + days * 86400000);

  await db.listing.update({
    where: { id: listing.id },
    data: { sortOrder, premiumTier: tier, premiumUntil },
  });
}

type TierFields = { premiumTier: "none" | "top" | "vip"; premiumUntil: Date | string | null };

// The tier to display right now, accounting for expiry.
export function activeTier(listing: TierFields): "top" | "vip" | null {
  if (listing.premiumTier === "none" || !listing.premiumUntil) return null;
  if (new Date(listing.premiumUntil).getTime() < Date.now()) return null;
  return listing.premiumTier;
}

// Re-derive premium tiers in a category after a sortOrder change. A listing
// whose position slot moved into a band gets that tier + the settings
// duration; one that moved out of the bands is demoted. A listing already
// holding the target tier keeps its existing expiry (repositioning inside a
// band doesn't restart the clock, and manual custom durations survive).
export async function syncCategoryTiers(categoryId: string) {
  const settings = await getSettings();
  const listings = await withRetry(() =>
    prisma.listing.findMany({
      where: {
        categoryId,
        status: "active",
        OR: [{ sortOrder: { lte: TOP_POSITIONS } }, { premiumTier: { not: "none" } }],
      },
      select: { id: true, sortOrder: true, premiumTier: true, premiumUntil: true },
    })
  );

  const now = Date.now();
  for (const listing of listings) {
    const target: "none" | "top" | "vip" =
      listing.sortOrder <= VIP_POSITIONS ? "vip" : listing.sortOrder <= TOP_POSITIONS ? "top" : "none";

    const current = activeTier(listing) ?? "none";
    if (current === target) continue;

    if (target === "none") {
      await withRetry(() =>
        prisma.listing.update({
          where: { id: listing.id },
          data: { premiumTier: "none", premiumUntil: null },
        })
      );
    } else {
      const days = target === "vip" ? settings.vipAdDays : settings.topAdDays;
      await withRetry(() =>
        prisma.listing.update({
          where: { id: listing.id },
          data: { premiumTier: target, premiumUntil: new Date(now + days * 86400000) },
        })
      );
    }
  }
}
