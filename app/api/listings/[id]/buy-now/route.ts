import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { user: { select: { email: true, phone: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.userId === userId) {
    return NextResponse.json({ error: "You can't buy your own listing" }, { status: 400 });
  }
  if (listing.status !== "active") return NextResponse.json({ error: "Listing is not active" }, { status: 400 });

  // Conditional update guards against two buyers racing to claim the same
  // listing — only the request that actually flips active -> sold wins.
  const claim = await prisma.listing.updateMany({
    where: { id, status: "active" },
    data: { status: "sold" },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "This item was just claimed by someone else" }, { status: 409 });
  }

  // Buyer and seller settle the actual item payment between themselves —
  // 2ndLife only takes a cut on listing fees, not the sale itself. Contact
  // info is only revealed here, to the buyer who just claimed it.
  return NextResponse.json({
    listing: { ...listing, status: "sold" },
    sellerContact: { email: listing.user.email, phone: listing.user.phone },
  });
}
