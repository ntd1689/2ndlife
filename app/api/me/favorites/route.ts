import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";

// The signed-in user's saved ads, newest-saved first. Only active listings are
// returned (favorites of expired/removed ads are hidden but the row is kept, so
// they reappear if the ad is relisted).
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const favorites = await withRetry(() =>
      prisma.favorite.findMany({
        where: { userId, listing: { status: "active", reviewStatus: "approved" } },
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            include: {
              // Card thumbnails are photos only (videos can't be optimized).
              media: { where: { type: "photo" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
              parish: true,
              category: true,
              subcategory: true,
              offers: { orderBy: { amount: "desc" }, take: 1, select: { amount: true } },
            },
          },
        },
      })
    );

    return NextResponse.json({ listings: favorites.map((f) => f.listing) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load favorites:", message);
    return NextResponse.json({ error: "Could not load your favorites right now" }, { status: 500 });
  }
}
