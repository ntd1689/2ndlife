import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

// The signed-in advertiser's payment history, newest first, with a
// server-computed refundEligible flag (completed + inside the admin-set
// refund window).
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const [payments, settings] = await Promise.all([
      withRetry(() =>
        prisma.payment.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: { listing: { select: { id: true, title: true } } },
        })
      ),
      getSettings(),
    ]);

    const windowMs = settings.refundWindowDays * 86400000;
    const now = Date.now();

    return NextResponse.json({
      refundWindowDays: settings.refundWindowDays,
      payments: payments.map((p) => ({
        id: p.id,
        type: p.type,
        provider: p.provider,
        amountJmd: p.amountJmd,
        status: p.status,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
        refundRequestedAt: p.refundRequestedAt,
        refundedAt: p.refundedAt,
        listing: p.listing,
        refundEligible:
          p.status === "completed" &&
          settings.refundWindowDays > 0 &&
          (p.completedAt ?? p.createdAt).getTime() > now - windowMs,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load payments:", message);
    return NextResponse.json({ error: "Could not load your payments right now" }, { status: 500 });
  }
}
