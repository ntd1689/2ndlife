import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const listing = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status !== "removed") {
    return NextResponse.json({ error: "Only admin-hidden listings can be unhidden" }, { status: 400 });
  }

  const updated = await withRetry(() =>
    prisma.listing.update({ where: { id }, data: { status: "active", archivedAt: null } })
  );
  return NextResponse.json({ listing: updated });
}
