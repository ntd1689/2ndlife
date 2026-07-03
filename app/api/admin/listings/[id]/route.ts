import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import { purgeListingMedia } from "@/lib/listings";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const listing = await withRetry(() =>
    prisma.listing.findUnique({ where: { id }, include: { media: true } })
  );
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status === "deleted") {
    return NextResponse.json({ error: "Listing already deleted" }, { status: 400 });
  }

  await purgeListingMedia(listing.id, listing.media);
  const updated = await withRetry(() =>
    prisma.listing.update({ where: { id }, data: { status: "deleted", deletedAt: new Date() } })
  );

  return NextResponse.json({ listing: updated });
}
