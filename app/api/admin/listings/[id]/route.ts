import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import { purgeListingMedia } from "@/lib/listings";
import { syncCategoryTiers, DEFAULT_SORT_ORDER, VIP_POSITIONS, TOP_POSITIONS } from "@/lib/premium";
import { getSettings } from "@/lib/settings";

const patchSchema = z
  .object({
    sortOrder: z.number().int().min(1).max(1_000_000).optional(),
    premiumTier: z.enum(["none", "top", "vip"]).optional(),
    premiumDays: z.number().int().min(1).max(365).optional(),
  })
  .refine((d) => d.sortOrder !== undefined || d.premiumTier !== undefined, {
    message: "Nothing to update",
  });

// Admin position/promotion controls:
// - { sortOrder } manually repositions the ad, then tiers across the category
//   are re-derived from rank (top 10 -> VIP, top 20 -> Top).
// - { premiumTier, premiumDays? } manually promotes/demotes: the ad is moved
//   into the matching position band and given the tier for premiumDays
//   (falling back to the admin-configured default duration).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
  }
  const { sortOrder, premiumTier, premiumDays } = parsed.data;

  const listing = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status !== "active") {
    return NextResponse.json({ error: "Only active ads can be positioned or promoted" }, { status: 400 });
  }

  if (premiumTier !== undefined) {
    const settings = await getSettings();
    let newSortOrder = DEFAULT_SORT_ORDER;
    if (premiumTier !== "none") {
      // Place the ad at the front of the matching band: VIP band is
      // positions 1-10, Top band is 11-20.
      const bandStart = premiumTier === "vip" ? 1 : VIP_POSITIONS + 1;
      const bandEnd = premiumTier === "vip" ? VIP_POSITIONS : TOP_POSITIONS;
      const taken = await withRetry(() =>
        prisma.listing.findMany({
          where: {
            categoryId: listing.categoryId,
            status: "active",
            id: { not: id },
            sortOrder: { gte: bandStart, lte: bandEnd },
          },
          select: { sortOrder: true },
        })
      );
      const used = new Set(taken.map((t) => t.sortOrder));
      newSortOrder = bandEnd; // band full -> share the last slot
      for (let slot = bandStart; slot <= bandEnd; slot += 1) {
        if (!used.has(slot)) { newSortOrder = slot; break; }
      }
    }

    const days =
      premiumTier === "vip" ? premiumDays ?? settings.vipAdDays :
      premiumTier === "top" ? premiumDays ?? settings.topAdDays : null;

    await withRetry(() =>
      prisma.listing.update({
        where: { id },
        data: {
          sortOrder: newSortOrder,
          premiumTier,
          premiumUntil: days ? new Date(Date.now() + days * 86400000) : null,
        },
      })
    );
    // Re-derive tiers for ads displaced by the move; the manually promoted ad
    // keeps its explicit tier/expiry because sync skips unchanged tiers.
    await syncCategoryTiers(listing.categoryId);
    const freshPromoted = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
    return NextResponse.json({ listing: freshPromoted });
  }

  const updated = await withRetry(() =>
    prisma.listing.update({ where: { id }, data: { sortOrder } })
  );
  await syncCategoryTiers(listing.categoryId);
  const fresh = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
  return NextResponse.json({ listing: fresh ?? updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const listing = await withRetry(() =>
    prisma.listing.findUnique({ where: { id }, include: { media: true } })
  );
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status === "deleted") {
    return NextResponse.json({ error: "Ad already deleted" }, { status: 400 });
  }

  await purgeListingMedia(listing.id, listing.media);
  const updated = await withRetry(() =>
    prisma.listing.update({ where: { id }, data: { status: "deleted", deletedAt: new Date() } })
  );

  return NextResponse.json({ listing: updated });
}
