import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import { refundPaypalOrder } from "@/lib/payments/paypal";
import { revertPaymentEffects } from "@/lib/payments/effects";

const schema = z.object({ action: z.enum(["approve", "deny"]) });

// Resolve a refund request. Approving refunds the money at the provider
// first — only if that succeeds do we mark the payment refunded and take
// back what it bought. Denying returns the payment to completed (the
// request timestamp/reason stay on the row as history).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const payment = await withRetry(() => prisma.payment.findUnique({ where: { id } }));
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.status !== "refund_requested") {
    return NextResponse.json({ error: "This payment has no open refund request" }, { status: 400 });
  }

  if (parsed.data.action === "deny") {
    const updated = await withRetry(() =>
      prisma.payment.update({ where: { id }, data: { status: "completed" } })
    );
    return NextResponse.json({ payment: updated });
  }

  // Approve: move the money back first.
  if (payment.provider !== "paypal" || !payment.providerRef) {
    return NextResponse.json({ error: "This payment's provider does not support automatic refunds" }, { status: 400 });
  }
  try {
    const refund = await refundPaypalOrder(payment.providerRef);
    if (refund?.status !== "COMPLETED" && refund?.status !== "PENDING") {
      return NextResponse.json({ error: `PayPal refund did not complete (status ${refund?.status})` }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PayPal refund failed:", message);
    return NextResponse.json({ error: "PayPal refused the refund — check the order in the PayPal dashboard" }, { status: 502 });
  }

  const updated = await withRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const marked = await tx.payment.update({
          where: { id },
          data: { status: "refunded", refundedAt: new Date() },
        });
        await revertPaymentEffects(tx, marked);
        return marked;
      },
      { timeout: 15000 }
    )
  );

  return NextResponse.json({ payment: updated });
}
