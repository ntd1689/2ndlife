import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ user: null });

  const user = await withRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { listings: true } } },
    })
  );
  return NextResponse.json({ user });
}
