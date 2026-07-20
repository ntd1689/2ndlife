import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import type { Prisma } from "@prisma/client";

// Ads analytics for admins: engagement (views) and revenue sliced by time,
// category, and parish, plus the top-visited ads — all scoped to a date range.
// Revenue counts captured, non-refunded payments (consistent with the Payments
// dashboard); views count ListingView rows created in the range.

function parseDay(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const monthKey = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM

// Ordered list of time buckets spanning [start, end], by day or month.
function buildBuckets(start: Date, end: Date, granularity: "day" | "month"): string[] {
  const keys: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), granularity === "day" ? start.getUTCDate() : 1));
  while (cur <= end) {
    keys.push(granularity === "day" ? dayKey(cur) : monthKey(cur));
    if (granularity === "day") cur.setUTCDate(cur.getUTCDate() + 1);
    else cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = parseDay(searchParams.get("from"));
  const toDay = parseDay(searchParams.get("to"));
  const to = toDay ? new Date(toDay.getTime() + 86_400_000) : null; // inclusive end day

  const inRange = <T extends { gte?: Date; lt?: Date }>(): T => {
    const f = {} as T;
    if (from) f.gte = from;
    if (to) f.lt = to;
    return f;
  };

  // Revenue = captured (completedAt set) and not refunded, in range.
  const completedAt: Prisma.DateTimeNullableFilter = { not: null, ...inRange() };
  const revenueWhere: Prisma.PaymentWhereInput = { completedAt, status: { not: "refunded" } };
  const viewWhere: Prisma.ListingViewWhereInput = Object.keys(inRange()).length ? { createdAt: inRange() } : {};

  const [payments, viewsByListing, activeListings] = await withRetry(() =>
    Promise.all([
      prisma.payment.findMany({
        where: revenueWhere,
        select: {
          amountJmd: true,
          completedAt: true,
          listing: { select: { category: { select: { name: true } }, parish: { select: { name: true } } } },
        },
      }),
      prisma.listingView.groupBy({ by: ["listingId"], where: viewWhere, _count: true }),
      prisma.listing.count({ where: { status: "active", reviewStatus: "approved" } }),
    ])
  );

  // --- Revenue aggregates ---
  const revenueJmd = payments.reduce((s, p) => s + p.amountJmd, 0);
  const orders = payments.length;

  const catRev = new Map<string, { amountJmd: number; count: number }>();
  const parishRev = new Map<string, { amountJmd: number; count: number }>();
  for (const p of payments) {
    const cat = p.listing?.category?.name ?? "Unlinked";
    const par = p.listing?.parish?.name ?? "Unlinked";
    const c = catRev.get(cat) ?? { amountJmd: 0, count: 0 };
    c.amountJmd += p.amountJmd; c.count += 1; catRev.set(cat, c);
    const r = parishRev.get(par) ?? { amountJmd: 0, count: 0 };
    r.amountJmd += p.amountJmd; r.count += 1; parishRev.set(par, r);
  }

  // Revenue-over-time buckets: day granularity, or month for spans over ~120 days.
  const paidDates = payments.map((p) => p.completedAt!).filter(Boolean);
  const start = from ?? (paidDates.length ? new Date(Math.min(...paidDates.map((d) => d.getTime()))) : null);
  const end = toDay ?? new Date();
  let revenueByBucket: { bucket: string; amountJmd: number }[] = [];
  let granularity: "day" | "month" = "day";
  if (start) {
    const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
    granularity = spanDays > 120 ? "month" : "day";
    const sums = new Map<string, number>();
    for (const p of payments) {
      const key = granularity === "day" ? dayKey(p.completedAt!) : monthKey(p.completedAt!);
      sums.set(key, (sums.get(key) ?? 0) + p.amountJmd);
    }
    revenueByBucket = buildBuckets(start, end, granularity).map((bucket) => ({ bucket, amountJmd: sums.get(bucket) ?? 0 }));
  }

  // --- View aggregates (reuse the one grouped query) ---
  const totalViews = viewsByListing.reduce((s, v) => s + v._count, 0);
  const listingIds = viewsByListing.map((v) => v.listingId);
  const listings = listingIds.length
    ? await withRetry(() =>
        prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: { id: true, title: true, status: true, category: { select: { name: true } }, parish: { select: { name: true } } },
        })
      )
    : [];
  const listingById = new Map(listings.map((l) => [l.id, l]));

  const topAds = viewsByListing
    .map((v) => ({ ...v, listing: listingById.get(v.listingId) }))
    .filter((v) => v.listing)
    .sort((a, b) => b._count - a._count)
    .slice(0, 10)
    .map((v) => ({
      listingId: v.listingId,
      title: v.listing!.title,
      views: v._count,
      category: v.listing!.category.name,
      parish: v.listing!.parish.name,
      status: v.listing!.status,
    }));

  const catViews = new Map<string, number>();
  const parishViews = new Map<string, number>();
  for (const v of viewsByListing) {
    const l = listingById.get(v.listingId);
    if (!l) continue;
    catViews.set(l.category.name, (catViews.get(l.category.name) ?? 0) + v._count);
    parishViews.set(l.parish.name, (parishViews.get(l.parish.name) ?? 0) + v._count);
  }

  const sortAmt = (m: Map<string, { amountJmd: number; count: number }>) =>
    [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amountJmd - a.amountJmd);
  const sortViews = (m: Map<string, number>) =>
    [...m.entries()].map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views);

  return NextResponse.json({
    kpis: { totalViews, revenueJmd, orders, activeListings },
    revenueByBucket,
    granularity,
    topAds,
    revenueByCategory: sortAmt(catRev),
    revenueByParish: sortAmt(parishRev),
    viewsByCategory: sortViews(catViews),
    viewsByParish: sortViews(parishViews),
  });
}
