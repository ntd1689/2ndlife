import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const schema = z.object({ reason: z.string().trim().min(5).max(1000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Tell us a bit more about the issue (5-1000 characters)" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, userId: true, status: true } });
  if (!listing || listing.status === "deleted") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.userId === userId) {
    return NextResponse.json({ error: "You can't report your own listing" }, { status: 400 });
  }

  await prisma.report.create({
    data: { listingId: listing.id, reporterId: userId, reason: parsed.data.reason },
  });

  return NextResponse.json({ ok: true });
}
