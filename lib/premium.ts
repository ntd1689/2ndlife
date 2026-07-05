import { prisma, withRetry } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

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
