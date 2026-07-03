import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/payments";
import { FEE_FEATURED_JMD, FEE_UNLIMITED_LISTING_JMD } from "@/lib/data/categories";

// Used during the "post an ad" flow, before the listing row exists yet.
// The client calls this to get a PayPal order id to show in the PayPal
// Buttons UI, then calls /capture once the buyer approves it, then creates
// the listing with plan=unlimited/featured already paid for.

const schema = z.object({
  provider: z.enum(["paypal", "lynk"]),
  unlimited: z.boolean().default(false),
  featured: z.boolean().default(false),
  listingId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { provider, unlimited, featured, listingId } = parsed.data;

    if (provider !== "paypal") {
      return NextResponse.json({ error: "Provider is not available yet" }, { status: 400 });
    }

    if (listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!listing || listing.userId !== userId) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }
    }

    const amount = (unlimited ? FEE_UNLIMITED_LISTING_JMD : 0) + (featured ? FEE_FEATURED_JMD : 0);
    if (amount === 0) return NextResponse.json({ error: "Nothing to charge for" }, { status: 400 });

    const order = await createOrder(provider, amount, "2ndLife: new listing plan");

    // One PayPal order can cover two effects (unlimited + featured) — record
    // a separate Payment row per effect, sharing the same providerRef, so
    // capture/webhook can apply both instead of only the last one.
    const paymentTypes: Array<{ type: "unlimited_listing" | "featured"; amountJmd: number }> = [];
    if (unlimited) paymentTypes.push({ type: "unlimited_listing", amountJmd: FEE_UNLIMITED_LISTING_JMD });
    if (featured) paymentTypes.push({ type: "featured", amountJmd: FEE_FEATURED_JMD });

    await prisma.payment.createMany({
      data: paymentTypes.map(({ type, amountJmd }) => ({
        userId,
        listingId,
        type,
        provider,
        amountJmd,
        providerRef: order.id,
        status: "pending" as const,
      })),
    });

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create PayPal order:", message);
    return NextResponse.json({ error: "Could not create payment order" }, { status: 500 });
  }
}
