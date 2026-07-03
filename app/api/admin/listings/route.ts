import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

const STATUSES = ["active", "expired", "archived", "deleted", "sold", "removed"] as const;

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const statusParam = searchParams.get("status");
  const status = STATUSES.find((s) => s === statusParam);
  const reportedOnly = searchParams.get("reported") === "true";

  const listings = await withRetry(() =>
    prisma.listing.findMany({
      where: {
        title: q ? { contains: q, mode: "insensitive" } : undefined,
        status,
        reports: reportedOnly ? { some: { status: "open" } } : undefined,
      },
      include: {
        media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
        user: { select: { id: true, email: true } },
        reports: { where: { status: "open" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  );

  return NextResponse.json({
    listings: listings.map((l) => ({ ...l, openReportCount: l.reports.length, reports: undefined })),
  });
}
