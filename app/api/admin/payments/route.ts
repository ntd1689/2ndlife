import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import type { Prisma } from "@prisma/client";

// Revenue reporting for admins: collected revenue, refunds, breakdowns by type
// and provider, the top-value advertisers, and a paginated ledger of the real
// transactions — all scoped to an optional date range (filtered on the day the
// money was captured, i.e. completedAt).

// Parse a YYYY-MM-DD string into a UTC day boundary; returns null if invalid.
function parseDay(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = parseDay(searchParams.get("from"));
  const toDay = parseDay(searchParams.get("to"));
  // `to` is inclusive of the whole day, so range to the start of the next day.
  const to = toDay ? new Date(toDay.getTime() + 86_400_000) : null;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 25));
  const typeFilter = searchParams.get("type") || "";

  // A "real transaction" is anything that was actually captured (completedAt
  // set): completed, refund_requested (money still held), or refunded.
  const completedAt: Prisma.DateTimeNullableFilter = { not: null };
  if (from) completedAt.gte = from;
  if (to) completedAt.lt = to;

  const validType = ["unlimited_listing", "featured", "relist", "top_ad", "vip_ad"].includes(typeFilter)
    ? (typeFilter as Prisma.PaymentWhereInput["type"])
    : undefined;

  // Collected revenue = captured and not refunded. Refunds are money returned.
  const revenueWhere: Prisma.PaymentWhereInput = { completedAt, status: { not: "refunded" }, ...(validType ? { type: validType } : {}) };
  const refundWhere: Prisma.PaymentWhereInput = {
    status: "refunded",
    refundedAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) },
    ...(validType ? { type: validType } : {}),
  };
  // Ledger shows every real transaction in range, refunds included.
  const ledgerWhere: Prisma.PaymentWhereInput = { completedAt, ...(validType ? { type: validType } : {}) };

  const [revenue, refunds, byType, byProvider, topRaw, total, payments] = await withRetry(() =>
    Promise.all([
      prisma.payment.aggregate({ where: revenueWhere, _sum: { amountJmd: true }, _count: true }),
      prisma.payment.aggregate({ where: refundWhere, _sum: { amountJmd: true }, _count: true }),
      prisma.payment.groupBy({ by: ["type"], where: revenueWhere, _sum: { amountJmd: true }, _count: true }),
      prisma.payment.groupBy({ by: ["provider"], where: revenueWhere, _sum: { amountJmd: true }, _count: true }),
      prisma.payment.groupBy({
        by: ["userId"],
        where: revenueWhere,
        _sum: { amountJmd: true },
        _count: true,
        orderBy: { _sum: { amountJmd: "desc" } },
        take: 10,
      }),
      prisma.payment.count({ where: ledgerWhere }),
      prisma.payment.findMany({
        where: ledgerWhere,
        orderBy: { completedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          provider: true,
          amountJmd: true,
          status: true,
          completedAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
          listing: { select: { id: true, title: true } },
        },
      }),
    ])
  );

  // Attach advertiser identity to the top-earners ranking.
  const topUsers = topRaw.length
    ? await withRetry(() =>
        prisma.user.findMany({
          where: { id: { in: topRaw.map((t) => t.userId) } },
          select: { id: true, email: true, name: true },
        })
      )
    : [];
  const userById = new Map(topUsers.map((u) => [u.id, u]));
  const topAdvertisers = topRaw.map((t) => ({
    userId: t.userId,
    email: userById.get(t.userId)?.email ?? "(unknown)",
    name: userById.get(t.userId)?.name ?? null,
    paymentCount: t._count,
    totalJmd: t._sum.amountJmd ?? 0,
  }));

  return NextResponse.json({
    summary: {
      revenueJmd: revenue._sum.amountJmd ?? 0,
      paymentCount: revenue._count,
      refundedJmd: refunds._sum.amountJmd ?? 0,
      refundCount: refunds._count,
      byType: byType
        .map((b) => ({ type: b.type, count: b._count, amountJmd: b._sum.amountJmd ?? 0 }))
        .sort((a, b) => b.amountJmd - a.amountJmd),
      byProvider: byProvider
        .map((b) => ({ provider: b.provider, count: b._count, amountJmd: b._sum.amountJmd ?? 0 }))
        .sort((a, b) => b.amountJmd - a.amountJmd),
    },
    topAdvertisers,
    payments,
    total,
    page,
    pageSize,
  });
}
