import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import { getAdminEmails } from "@/lib/env";

const schema = z.object({ action: z.enum(["block", "unblock"]) });

// Block or unblock an account. A blocked user can't log in, and their
// existing session stops working immediately (getSessionUserId checks it).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const user = await withRetry(() => prisma.user.findUnique({ where: { id } }));
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (parsed.data.action === "block") {
    if (user.id === admin.id) {
      return NextResponse.json({ error: "You can't block your own account" }, { status: 400 });
    }
    if (getAdminEmails().has(user.email.toLowerCase())) {
      return NextResponse.json({ error: "This account is an administrator — remove it from ADMIN_EMAILS first" }, { status: 400 });
    }
  }

  const updated = await withRetry(() =>
    prisma.user.update({
      where: { id },
      data: { blockedAt: parsed.data.action === "block" ? new Date() : null },
      select: { id: true, email: true, blockedAt: true },
    })
  );

  return NextResponse.json({ user: updated });
}
