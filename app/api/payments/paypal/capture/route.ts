import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { applyPaymentEffects } from "@/lib/payments/effects";
import { capturePaypalOrder, getPaypalOrder } from "@/lib/payments/paypal";

const schema = z.object({ orderId: z.string(), listingId: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    // A single PayPal order can cover more than one effect (e.g. unlimited +
    // featured purchased together), recorded as multiple Payment rows
    // sharing the same providerRef.
    let payments = await prisma.payment.findMany({
      where: { providerRef: parsed.data.orderId, userId },
    });
    if (payments.length === 0) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (payments.every((p) => p.status === "completed")) {
      return NextResponse.json({ ok: true, idempotent: true, payments });
    }

    if (parsed.data.listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
      if (!listing || listing.userId !== userId) {
        return NextResponse.json({ error: "Ad not found" }, { status: 404 });
      }

      const unlinked = payments.filter((p) => !p.listingId);
      if (unlinked.length > 0) {
        await prisma.payment.updateMany({
          where: { id: { in: unlinked.map((p) => p.id) } },
          data: { listingId: parsed.data.listingId },
        });
        payments = await prisma.payment.findMany({
          where: { providerRef: parsed.data.orderId, userId },
        });
      }
    }

    let success = false;
    try {
      const capture = await capturePaypalOrder(parsed.data.orderId);
      success = capture?.status === "COMPLETED";
    } catch {
      // If capture already happened remotely, fallback to order lookup.
      const order = await getPaypalOrder(parsed.data.orderId);
      success = order?.status === "COMPLETED";
    }

    if (!success) {
      await prisma.payment.updateMany({
        where: { id: { in: payments.map((p) => p.id) }, status: "pending" },
        data: { status: "failed", completedAt: null },
      });
      return NextResponse.json({ error: "Payment was not completed" }, { status: 400 });
    }

    const updatedCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const payment of payments) {
        const mark = await tx.payment.updateMany({
          where: { id: payment.id, status: "pending" },
          data: { status: "completed", completedAt: new Date() },
        });
        if (mark.count === 1) {
          await applyPaymentEffects(tx, payment);
          count += 1;
        }
      }
      return count;
    });

    const latest = await prisma.payment.findMany({ where: { providerRef: parsed.data.orderId, userId } });
    return NextResponse.json({ ok: true, idempotent: updatedCount === 0, payments: latest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PayPal capture failed:", message);
    return NextResponse.json({ error: "Could not finalize payment" }, { status: 500 });
  }
}
