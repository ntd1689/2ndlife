import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const listings = await withRetry(() =>
      prisma.listing.findMany({
        where: {
          userId,
          status: { not: "deleted" },
        },
        include: {
          media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          parish: true,
          category: true,
          subcategory: true,
          // Amounts only — buyer contact stays private until the seller
          // accepts, and even then it's the seller's contact that is shared.
          offers: {
            orderBy: { amount: "desc" },
            select: { id: true, amount: true, createdAt: true, acceptedAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({ listings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load my listings:", message);
    return NextResponse.json({ error: "Could not load your ads right now" }, { status: 500 });
  }
}
