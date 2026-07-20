import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

// Search users by email or phone (or list the most recent when no query).
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";

  const users = await withRetry(() =>
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
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
    })
  );

  return NextResponse.json({
    users: users.map((u) => ({ ...u, listingCount: u._count.listings, paymentCount: u._count.payments, _count: undefined })),
  });
}
