import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { getAdminEmails } from "@/lib/env";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ user: null, isAdmin: false });

  const user = await withRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { listings: true } } },
    })
  );
  const isAdmin = !!user && getAdminEmails().has(user.email.toLowerCase());
  const isReviewer = !!user && (isAdmin || user.userType === "ads_reviewer");
  return NextResponse.json({ user, isAdmin, isReviewer });
}
