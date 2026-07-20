import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

const STATUSES = ["active", "expired", "archived", "deleted", "sold", "removed"] as const;

// Admin list ordering options; "position" is the marketplace's own ranking.
const SORTS: Record<string, { orderBy: object[] }> = {
  position: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] },
  created_desc: { orderBy: [{ createdAt: "desc" }] },
  created_asc: { orderBy: [{ createdAt: "asc" }] },
  updated_desc: { orderBy: [{ updatedAt: "desc" }] },
  updated_asc: { orderBy: [{ updatedAt: "asc" }] },
};

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const statusParam = searchParams.get("status");
  const status = STATUSES.find((s) => s === statusParam);
  const reportedOnly = searchParams.get("reported") === "true";
  const sort = SORTS[searchParams.get("sort") ?? "position"] ?? SORTS.position;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 25));

  const where = {
    title: q ? { contains: q, mode: "insensitive" as const } : undefined,
    status,
    reports: reportedOnly ? { some: { status: "open" as const } } : undefined,
  };

  const [total, listings] = await withRetry(() =>
    Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        include: {
          media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
          user: { select: { id: true, email: true } },
          reports: { where: { status: "open" }, select: { id: true } },
          category: { select: { name: true } },
          _count: { select: { views: true } },
        },
        orderBy: sort.orderBy as never,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
  );

  return NextResponse.json({
    listings: listings.map((l) => ({
      ...l,
      openReportCount: l.reports.length,
      uniqueViews: l._count.views,
      reports: undefined,
      _count: undefined,
    })),
    total,
    page,
    pageSize,
  });
}
