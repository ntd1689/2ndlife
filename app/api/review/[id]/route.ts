import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionReviewer } from "@/lib/review";
import {
  sendAdApprovedEmail,
  sendAdRejectedEmail,
  sendAdChangesRequestedEmail,
} from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

const schema = z
  .object({
    action: z.enum(["approve", "reject", "request_changes", "flag", "unflag"]),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((d) => (d.action === "reject" || d.action === "request_changes" ? !!d.note && d.note.length >= 3 : true), {
    message: "Please add a note explaining the reason",
  });

// Reviewers and admins act on an ad in the queue. Approve makes it public;
// reject/request-changes keep it hidden with a note; flag/unflag toggles the
// admin-attention marker. Each decision emails the advertiser.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reviewer = await getSessionReviewer();
  if (!reviewer) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid action" }, { status: 400 });
  }
  const { action, note } = parsed.data;

  const listing = await withRetry(() =>
    prisma.listing.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    })
  );
  if (!listing) return NextResponse.json({ error: "Ad not found" }, { status: 404 });

  const now = new Date();
  const ad = { id: listing.id, title: listing.title };

  if (action === "flag" || action === "unflag") {
    const updated = await withRetry(() =>
      prisma.listing.update({
        where: { id },
        data: { flaggedForAdmin: action === "flag", reviewNote: note ?? listing.reviewNote },
        select: { id: true, flaggedForAdmin: true },
      })
    );
    return NextResponse.json({ listing: updated });
  }

  const reviewData =
    action === "approve"
      ? { reviewStatus: "approved" as const, reviewNote: null, flaggedForAdmin: false }
      : action === "reject"
        ? { reviewStatus: "rejected" as const, reviewNote: note ?? null }
        : { reviewStatus: "changes_requested" as const, reviewNote: note ?? null };

  const updated = await withRetry(() =>
    prisma.listing.update({
      where: { id },
      data: { ...reviewData, reviewedAt: now, reviewedById: reviewer.id },
      select: { id: true, reviewStatus: true, reviewNote: true, flaggedForAdmin: true },
    })
  );

  // Notify the advertiser of the decision (best-effort — never fails the action).
  if (action === "approve") {
    await sendAdApprovedEmail(listing.user.email, ad);
    await sendPushToUser(listing.userId, { title: "Your ad was approved ✅", body: `"${listing.title}" is now live.`, url: `/listing/${listing.id}`, tag: `ad-${listing.id}` });
  } else if (action === "reject") {
    await sendAdRejectedEmail(listing.user.email, ad, note ?? null);
    await sendPushToUser(listing.userId, { title: "Your ad wasn't approved", body: `"${listing.title}" — tap for details.`, url: "/my-ads", tag: `ad-${listing.id}` });
  } else {
    await sendAdChangesRequestedEmail(listing.user.email, ad, note ?? null);
    await sendPushToUser(listing.userId, { title: "Changes requested on your ad", body: `Please update "${listing.title}".`, url: "/my-ads", tag: `ad-${listing.id}` });
  }

  return NextResponse.json({ listing: updated });
}
