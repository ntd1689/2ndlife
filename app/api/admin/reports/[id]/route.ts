import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";

const schema = z.object({ status: z.enum(["resolved", "dismissed"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const report = await withRetry(() => prisma.report.findUnique({ where: { id } }));
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await withRetry(() =>
    prisma.report.update({
      where: { id },
      data: { status: parsed.data.status, resolvedAt: new Date() },
    })
  );
  return NextResponse.json({ report: updated });
}
