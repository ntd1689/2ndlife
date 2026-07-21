import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sendPushToUsers, getAdminUserIds } from "@/lib/push";

const schema = z.object({
  reason: z.string().trim().min(5, "Tell us briefly why you want a refund (at least 5 characters)").max(1000),
});

// Advertiser asks for their money back. Only completed payments inside the
// admin-configured refund window qualify; an admin then approves or denies
// from the dashboard.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const payment = await withRetry(() => prisma.payment.findUnique({ where: { id } }));
  if (!payment || payment.userId !== userId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status === "refund_requested") {
    return NextResponse.json({ error: "A refund has already been requested for this payment" }, { status: 400 });
  }
  if (payment.status === "refunded") {
    return NextResponse.json({ error: "This payment has already been refunded" }, { status: 400 });
  }
  if (payment.status !== "completed") {
    return NextResponse.json({ error: "Only completed payments can be refunded" }, { status: 400 });
  }

  const settings = await getSettings();
  if (settings.refundWindowDays <= 0) {
    return NextResponse.json({ error: "Refunds are not currently offered" }, { status: 400 });
  }
  const paidAt = payment.completedAt ?? payment.createdAt;
  if (paidAt.getTime() <= Date.now() - settings.refundWindowDays * 86400000) {
    return NextResponse.json(
      { error: `Refunds can only be requested within ${settings.refundWindowDays} day${settings.refundWindowDays === 1 ? "" : "s"} of payment` },
      { status: 400 }
    );
  }

  // Guard the status transition so a concurrent request can't double-file.
  const updated = await withRetry(() =>
    prisma.payment.updateMany({
      where: { id, status: "completed" },
      data: { status: "refund_requested", refundRequestedAt: new Date(), refundReason: parsed.data.reason },
    })
  );
  if (updated.count === 0) {
    return NextResponse.json({ error: "This payment can no longer be refunded" }, { status: 409 });
  }

  // Alert admins of the new refund request (best-effort).
  await sendPushToUsers(await getAdminUserIds(), {
    title: "New refund request",
    body: `J$${payment.amountJmd.toLocaleString()} — ${payment.type.replace(/_/g, " ")}`,
    url: "/admin?section=refunds",
    tag: "refund-queue",
  });

  const fresh = await withRetry(() => prisma.payment.findUnique({ where: { id } }));
  return NextResponse.json({ payment: fresh });
}
