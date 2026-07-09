import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Save a listing to the signed-in user's favorites. Idempotent — saving an
// already-favorited ad is a no-op success.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const listing = await withRetry(() =>
    prisma.listing.findUnique({ where: { id }, select: { id: true, status: true } })
  );
  if (!listing || listing.status !== "active") {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  await withRetry(() =>
    prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId: id } },
      create: { userId, listingId: id },
      update: {},
    })
  );

  return NextResponse.json({ favorited: true });
}

// Remove a listing from the signed-in user's favorites. Idempotent.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await withRetry(() =>
    prisma.favorite.deleteMany({ where: { userId, listingId: id } })
  );

  return NextResponse.json({ favorited: false });
}
