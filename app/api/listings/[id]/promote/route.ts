import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { createOrder } from "@/lib/payments";
import { getSettings } from "@/lib/settings";

// Seller-facing promotion checkout. The seller picks Top or VIP for one of
// their own active ads; this creates a PayPal order for the admin-configured
// price and a pending Payment carrying the tier + snapshotted duration. The
// existing /capture (or webhook) applies the promotion once PayPal confirms.

const schema = z.object({
  provider: z.enum(["paypal", "lynk"]),
  tier: z.enum(["top", "vip"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { provider, tier } = parsed.data;

  if (provider !== "paypal") {
    return NextResponse.json({ error: "Provider is not available yet" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.userId !== userId) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }
  if (listing.status !== "active") {
    return NextResponse.json({ error: "Only active ads can be promoted" }, { status: 400 });
  }

  const settings = await getSettings();
  const priceJmd = tier === "vip" ? settings.vipAdPriceJmd : settings.topAdPriceJmd;
  const days = tier === "vip" ? settings.vipAdDays : settings.topAdDays;
  if (priceJmd <= 0) {
    return NextResponse.json({ error: "This promotion isn't available right now" }, { status: 400 });
  }

  const label = tier === "vip" ? "VIP" : "Top";
  const order = await createOrder(provider, priceJmd, `2ndLife: promote "${listing.title}" to ${label} for ${days} days`);

  await prisma.payment.create({
    data: {
      userId,
      listingId: listing.id,
      type: tier === "vip" ? "vip_ad" : "top_ad",
      provider,
      amountJmd: priceJmd,
      premiumDays: days,
      providerRef: order.id,
      status: "pending",
    },
  });

  return NextResponse.json({ orderId: order.id });
}
