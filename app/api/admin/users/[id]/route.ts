import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionAdmin } from "@/lib/admin";
import { getAdminEmails } from "@/lib/env";

const schema = z.object({ action: z.enum(["block", "unblock", "make_reviewer", "remove_reviewer"]) });

// Block/unblock an account, or grant/revoke the ads_reviewer role. A blocked
// user can't log in, and their existing session stops working immediately
// (getSessionUserId checks it).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const user = await withRetry(() => prisma.user.findUnique({ where: { id } }));
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (parsed.data.action === "make_reviewer" || parsed.data.action === "remove_reviewer") {
    const updated = await withRetry(() =>
      prisma.user.update({
        where: { id },
        data: { userType: parsed.data.action === "make_reviewer" ? "ads_reviewer" : "advertiser" },
        select: { id: true, email: true, userType: true },
      })
    );
    return NextResponse.json({ user: updated });
  }

  if (parsed.data.action === "block") {
    if (user.id === admin.id) {
      return NextResponse.json({ error: "You can't block your own account" }, { status: 400 });
    }
    if (getAdminEmails().has(user.email.toLowerCase())) {
      return NextResponse.json({ error: "This account is an administrator — remove it from ADMIN_EMAILS first" }, { status: 400 });
    }
  }

  if (parsed.data.action === "block") {
    // One shared timestamp marks both the block and the ads it hides, so
    // unblock can restore exactly these ads and nothing else.
    const now = new Date();
    const [updated, hidden] = await withRetry(() =>
      prisma.$transaction(
        [
          prisma.user.update({
            where: { id },
            data: { blockedAt: now },
            select: { id: true, email: true, blockedAt: true },
          }),
          prisma.listing.updateMany({
            where: { userId: id, status: "active" },
            data: { status: "removed", archivedAt: now },
          }),
        ]
      )
    );
    return NextResponse.json({ user: updated, hiddenAds: hidden.count });
  }

  // Unblock: bring back only the ads this block hid (archivedAt matches the
  // block timestamp) — ads a moderator removed separately stay hidden.
  const blockedAt = user.blockedAt;
  const [updated, restored] = await withRetry(() =>
    prisma.$transaction(
      [
        prisma.user.update({
          where: { id },
          data: { blockedAt: null },
          select: { id: true, email: true, blockedAt: true },
        }),
        prisma.listing.updateMany({
          where: blockedAt
            ? { userId: id, status: "removed", archivedAt: blockedAt }
            : { id: "never-matches" },
          data: { status: "active", archivedAt: null },
        }),
      ]
    )
  );
  return NextResponse.json({ user: updated, restoredAds: restored.count });
}
