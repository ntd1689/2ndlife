import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const listing = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status === "removed" || listing.status === "deleted") {
    return NextResponse.json({ error: "Ad is already hidden" }, { status: 400 });
  }

  const now = new Date();
  const [updated] = await withRetry(() =>
    prisma.$transaction([
      prisma.listing.update({ where: { id }, data: { status: "removed", archivedAt: now } }),
      prisma.report.updateMany({
        where: { listingId: id, status: "open" },
        data: { status: "resolved", resolvedAt: now },
      }),
    ])
  );

  return NextResponse.json({ listing: updated });
}
