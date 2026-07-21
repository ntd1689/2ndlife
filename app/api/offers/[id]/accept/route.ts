import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { sendOfferAcceptedEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const offer = await withRetry(() =>
    prisma.offer.findUnique({
      where: { id },
      include: {
        listing: { select: { id: true, userId: true, status: true, title: true } },
        buyer: { select: { email: true } },
      },
    })
  );
  if (!offer || offer.listing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (offer.acceptedAt) {
    return NextResponse.json({ error: "Offer already accepted" }, { status: 400 });
  }
  if (offer.listing.status !== "active") {
    return NextResponse.json({ error: "Ad is no longer active" }, { status: 400 });
  }

  // Flip the listing active -> sold atomically so two accepts (or an accept
  // racing a moderator action) can't both win.
  const accepted = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      const claim = await tx.listing.updateMany({
        where: { id: offer.listing.id, status: "active" },
        data: { status: "sold" },
      });
      if (claim.count === 0) return null;
      return tx.offer.update({
        where: { id },
        data: { acceptedAt: new Date() },
      });
    })
  );
  if (!accepted) {
    return NextResponse.json({ error: "Ad is no longer active" }, { status: 409 });
  }

  // Tell the winning buyer how to reach the seller. Best-effort: the deal is
  // already closed, and the buyer also sees the contact info on the listing page.
  const seller = await withRetry(() =>
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } })
  );
  if (seller) {
    try {
      await sendOfferAcceptedEmail(offer.buyer.email, offer.listing.title, offer.amount, seller);
    } catch (e) {
      console.error("Failed to send offer-accepted email:", e instanceof Error ? e.message : e);
    }
  }

  // Push the winning buyer (best-effort).
  await sendPushToUser(offer.buyerId, {
    title: "Your offer was accepted 🎉",
    body: `J$${offer.amount.toLocaleString()} — ${offer.listing.title}`,
    url: `/listing/${offer.listing.id}`,
    tag: `offer-accepted-${offer.listing.id}`,
  });

  return NextResponse.json({ ok: true, offer: accepted });
}
