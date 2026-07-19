import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

// Open refund requests, oldest first so the queue is worked in order.
export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const requests = await withRetry(() =>
    prisma.payment.findMany({
      where: { status: "refund_requested" },
      orderBy: { refundRequestedAt: "asc" },
      include: {
        user: { select: { email: true, name: true } },
        listing: { select: { id: true, title: true } },
      },
    })
  );

  return NextResponse.json({ requests });
}
