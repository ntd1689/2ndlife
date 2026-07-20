import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

// Search users by email or phone (or list the most recent when no query).
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 25));

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [total, users] = await withRetry(() =>
    Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          userType: true,
          createdAt: true,
          blockedAt: true,
          _count: { select: { listings: true, payments: true } },
        },
      }),
    ])
  );

  return NextResponse.json({
    users: users.map((u) => ({ ...u, listingCount: u._count.listings, paymentCount: u._count.payments, _count: undefined })),
    total,
    page,
    pageSize,
  });
}
