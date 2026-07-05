import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { purgeListingMedia } from "@/lib/listings";
import { ARCHIVE_WINDOW_DAYS } from "@/lib/data/categories";
import { getCronSecret } from "@/lib/env";
import { DEFAULT_SORT_ORDER } from "@/lib/premium";

// Configure this as a Vercel Cron job (see vercel.json) hitting this route
// once a day. Protect it with CRON_SECRET so only Vercel's scheduler (or you)
// can trigger it.

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${getCronSecret()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 0. Premium tiers whose duration has lapsed lose their badge and return
  //    to the default position.
  const premiumExpired = await withRetry(() =>
    prisma.listing.updateMany({
      where: { premiumTier: { not: "none" }, premiumUntil: { lt: now } },
      data: { premiumTier: "none", premiumUntil: null, sortOrder: DEFAULT_SORT_ORDER },
    })
  );

  // 1. Expire free listings whose free window has passed.
  const expired = await withRetry(() =>
    prisma.listing.updateMany({
      where: { status: "active", plan: "free", expiresAt: { lt: now } },
      data: { status: "expired", archivedAt: now },
    })
  );

  // 2. Permanently delete media for listings archived/removed 30+ days ago.
  const archiveCutoff = new Date(now.getTime() - ARCHIVE_WINDOW_DAYS * 86400000);
  const toDelete = await withRetry(() =>
    prisma.listing.findMany({
      where: { status: { in: ["expired", "archived", "removed"] }, archivedAt: { lt: archiveCutoff } },
      include: { media: true },
    })
  );

  for (const listing of toDelete) {
    await purgeListingMedia(listing.id, listing.media);
    await withRetry(() =>
      prisma.listing.update({
        where: { id: listing.id },
        data: { status: "deleted", deletedAt: now },
      })
    );
  }

  return NextResponse.json({
    expiredCount: expired.count,
    deletedCount: toDelete.length,
    premiumExpiredCount: premiumExpired.count,
  });
}
