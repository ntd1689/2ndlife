import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionReviewer } from "@/lib/review";

// The reviewer dashboard feed: ads awaiting a decision (pending or previously
// changes-requested that were resubmitted land back as pending), plus open
// reports. Flagged-for-admin ads are surfaced first.
export async function GET() {
  const reviewer = await getSessionReviewer();
  if (!reviewer) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const [ads, reports] = await Promise.all([
    withRetry(() =>
      prisma.listing.findMany({
        where: {
          status: { in: ["active", "expired", "sold"] },
          reviewStatus: { in: ["pending", "changes_requested"] },
        },
        orderBy: [{ flaggedForAdmin: "desc" }, { submittedAt: "asc" }],
        take: 200,
        include: {
          media: { where: { type: "photo" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
          user: { select: { email: true, name: true } },
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          parish: { select: { name: true } },
        },
      })
    ),
    withRetry(() =>
      prisma.report.findMany({
        where: { status: "open" },
        orderBy: { createdAt: "asc" },
        include: {
          listing: { select: { id: true, title: true, status: true, reviewStatus: true } },
          reporter: { select: { email: true } },
        },
      })
    ),
  ]);

  return NextResponse.json({
    ads: ads.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      reviewStatus: a.reviewStatus,
      flaggedForAdmin: a.flaggedForAdmin,
      submittedAt: a.submittedAt,
      askingPrice: a.askingPrice,
      image: a.media[0]?.url ?? null,
      owner: a.user,
      category: a.category.name,
      subcategory: a.subcategory.name,
      parish: a.parish.name,
      reviewNote: a.reviewNote,
    })),
    reports,
    isAdmin: reviewer.isAdmin,
  });
}
