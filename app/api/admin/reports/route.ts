import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

const STATUSES = ["open", "resolved", "dismissed"] as const;

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") || "open";
  const status = STATUSES.find((s) => s === statusParam) ?? "open";

  const reports = await withRetry(() =>
    prisma.report.findMany({
      where: { status },
      include: {
        listing: { select: { id: true, title: true, status: true } },
        reporter: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  );

  return NextResponse.json({ reports });
}
