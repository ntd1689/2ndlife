import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPaymentEffects } from "@/lib/payments/effects";
import { verifyPaypalWebhookSignature } from "@/lib/payments/paypal";

function getOrderIdFromEvent(event: any): string | null {
  const directOrderId = event?.resource?.id;
  if (event?.event_type === "CHECKOUT.ORDER.APPROVED" && typeof directOrderId === "string") {
    return directOrderId;
  }

  const relatedOrderId = event?.resource?.supplementary_data?.related_ids?.order_id;
  if (typeof relatedOrderId === "string") {
    return relatedOrderId;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const event = JSON.parse(raw);

    const isValid = await verifyPaypalWebhookSignature(req.headers, raw, event);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const orderId = getOrderIdFromEvent(event);
    if (!orderId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // A single PayPal order can cover more than one effect (e.g. unlimited +
    // featured purchased together), recorded as multiple Payment rows
    // sharing the same providerRef.
    const payments = await prisma.payment.findMany({ where: { providerRef: orderId } });
    if (payments.length === 0) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (payments.every((p) => p.status === "completed")) {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const updated = await prisma.$transaction(async (tx) => {
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

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PayPal webhook failed:", message);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
