import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

const schema = z.object({ amount: z.number().int().positive() });

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  const { amount } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { id },
          include: { offers: { orderBy: { amount: "desc" }, take: 1 } },
        });
        if (!listing || listing.reviewStatus !== "approved") throw new ApiError(404, "Not found");
        if (listing.userId === userId) throw new ApiError(400, "You can't make an offer on your own listing");
        if (listing.status !== "active") throw new ApiError(400, "Listing is not active");
        if (listing.offerEndAt && listing.offerEndAt < new Date()) {
          throw new ApiError(400, "Offers have closed on this listing");
        }

        const currentHigh = listing.offers[0]?.amount ?? 0;
        if (amount <= currentHigh) {
          throw new ApiError(400, `Your offer must be more than the current highest (J$${currentHigh.toLocaleString()})`);
        }

        const created = await tx.offer.create({
          data: { listingId: listing.id, buyerId: userId, amount },
        });
        return { offer: created, ownerId: listing.userId, title: listing.title };
      },
      { isolationLevel: "Serializable" }
    );

    // Notify the seller of the new offer (best-effort).
    await sendPushToUser(result.ownerId, {
      title: "New offer on your ad",
      body: `J$${amount.toLocaleString()} — ${result.title}`,
      url: "/my-ads",
      tag: `offer-${result.offer.listingId}`,
    });

    return NextResponse.json({ offer: result.offer });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Serializable transactions can fail under real concurrency (two offers
    // racing for the same listing) — ask the client to retry with fresh data.
    return NextResponse.json(
      { error: "Someone else may have just made an offer — please refresh and try again" },
      { status: 409 }
    );
  }
}
