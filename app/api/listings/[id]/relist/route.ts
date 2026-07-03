import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { createOrder } from "@/lib/payments";
import { FEE_RELIST_JMD } from "@/lib/data/categories";

const schema = z.object({ provider: z.enum(["paypal", "lynk"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider" }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.status !== "expired") {
    return NextResponse.json({ error: "Only expired listings can be re-listed" }, { status: 400 });
  }

  const order = await createOrder(
    parsed.data.provider,
    FEE_RELIST_JMD,
    `2ndLife: re-list "${listing.title}"`
  );

  await prisma.payment.create({
    data: {
      userId,
      listingId: listing.id,
      type: "relist",
      provider: parsed.data.provider,
      amountJmd: FEE_RELIST_JMD,
      providerRef: order.id,
      status: "pending",
    },
  });

  return NextResponse.json({ orderId: order.id });
}
