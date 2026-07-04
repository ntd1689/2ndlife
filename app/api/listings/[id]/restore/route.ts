import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { ARCHIVE_WINDOW_DAYS } from "@/lib/data/categories";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const listing = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
  if (!listing || listing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.status !== "archived" || !listing.archivedAt) {
    return NextResponse.json({ error: "Only archived ads can be restored" }, { status: 400 });
  }

  const msInDay = 86400000;
  const archiveExpiresAt = listing.archivedAt.getTime() + ARCHIVE_WINDOW_DAYS * msInDay;
  if (Date.now() > archiveExpiresAt) {
    return NextResponse.json({ error: "Archive window ended. This ad can no longer be restored." }, { status: 400 });
  }

  const restored = await withRetry(() =>
    prisma.listing.update({
      where: { id },
      data: { status: "active", archivedAt: null },
    })
  );
  return NextResponse.json({ listing: restored });
}
