import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { BID_INCREMENT_JMD } from "@/lib/data/categories";

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
    const bid = await prisma.$transaction(
      async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { id },
          include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
        });
        if (!listing) throw new ApiError(404, "Not found");
        if (!listing.biddingEnabled) throw new ApiError(400, "Bidding not enabled on this listing");
        if (listing.status !== "active") throw new ApiError(400, "Listing is not active");
        if (listing.bidEndAt && listing.bidEndAt < new Date()) {
          throw new ApiError(400, "Bidding has closed on this listing");
        }

        const currentHigh = listing.bids[0]?.amount ?? listing.minBid ?? 0;
        const minNext = currentHigh + BID_INCREMENT_JMD;

        if (amount < minNext) {
          throw new ApiError(400, `Bid must be at least J$${minNext}`);
        }
        if (listing.minBid != null && (amount - listing.minBid) % BID_INCREMENT_JMD !== 0) {
          throw new ApiError(400, `Bids must move in J$${BID_INCREMENT_JMD} increments`);
        }

        return tx.bid.create({
          data: { listingId: listing.id, bidderId: userId, amount },
        });
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json({ bid });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Serializable transactions can fail under real concurrency (two bids
    // racing for the same listing) — ask the client to retry with fresh data.
    return NextResponse.json(
      { error: "Someone else may have just bid on this — please refresh and try again" },
      { status: 409 }
    );
  }
}
