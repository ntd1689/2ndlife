import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { MAX_PHOTOS } from "@/lib/data/categories";

// One ListingView row per unique viewer: logged-in users are keyed by user
// id, anonymous visitors by a hash of IP + user agent. The owner's own visits
// are not counted.
async function recordUniqueView(req: NextRequest, listingId: string, ownerId: string, viewerId: string | null) {
  if (viewerId === ownerId) return;
  const viewerKey =
    viewerId ??
    "anon:" +
      createHash("sha256")
        .update((req.headers.get("x-forwarded-for") || "").split(",")[0].trim() + "|" + (req.headers.get("user-agent") || ""))
        .digest("hex");
  try {
    await prisma.listingView.createMany({
      data: [{ listingId, viewerKey }],
      skipDuplicates: true,
    });
  } catch {
    // View tracking is best-effort; never fail the page over it.
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Seller email/phone are intentionally excluded from the listing payload —
  // this route is public. Contact info is only revealed to the one buyer
  // whose offer the seller accepted (see `viewer` below).
  const listing = await withRetry(() =>
    prisma.listing.findUnique({
      where: { id },
      include: {
        media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        parish: true,
        category: true,
        subcategory: true,
        offers: { orderBy: { amount: "desc" }, select: { id: true, amount: true, createdAt: true } },
        _count: { select: { views: true } },
      },
    })
  );
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status === "archived" || listing.status === "deleted" || listing.status === "removed") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If the signed-in viewer is the buyer whose offer was accepted, include
  // the seller's contact info so the two can close the deal off-platform.
  let viewer: {
    offerAccepted: boolean;
    sellerContact: { email: string; phone: string | null } | null;
    isFavorited: boolean;
  } = {
    offerAccepted: false,
    sellerContact: null,
    isFavorited: false,
  };
  const viewerId = await getSessionUserId();
  await recordUniqueView(req, id, listing.userId, viewerId);
  if (viewerId) {
    const [acceptedOffer, favorite] = await withRetry(() =>
      Promise.all([
        prisma.offer.findFirst({
          where: { listingId: id, buyerId: viewerId, acceptedAt: { not: null } },
          include: { listing: { select: { user: { select: { email: true, phone: true } } } } },
        }),
        prisma.favorite.findUnique({
          where: { userId_listingId: { userId: viewerId, listingId: id } },
          select: { id: true },
        }),
      ])
    );
    if (acceptedOffer) {
      viewer.offerAccepted = true;
      viewer.sellerContact = acceptedOffer.listing.user;
    }
    viewer.isFavorited = !!favorite;
  }

  return NextResponse.json({
    listing: { ...listing, uniqueViews: listing._count.views, _count: undefined },
    viewer,
  });
}

const updateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(1, "Please add a description"),
  askingPrice: z.number().int().positive().nullable().optional(),
  parish: z.string(),
  category: z.string(),
  subcategory: z.string(),
  removeMediaIds: z.array(z.string()).optional().default([]),
  mediaUrls: z
    .array(
      z.object({
        clientId: z.string(),
        type: z.enum(["photo", "video"]),
        url: z.string(),
        sizeBytes: z.number().int().positive(),
      })
    )
    .optional()
    .default([]),
  mediaOrderRefs: z.array(z.string()).optional().default([]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ad update" }, { status: 400 });
  const data = parsed.data;

  const listing = await withRetry(() =>
    prisma.listing.findUnique({
      where: { id },
      include: { media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    })
  );
  if (!listing || listing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.status !== "active") {
    return NextResponse.json({ error: "Only active ads can be edited" }, { status: 400 });
  }

  const [parish, category] = await withRetry(() =>
    Promise.all([
      prisma.parish.findUnique({ where: { name: data.parish } }),
      prisma.category.findUnique({ where: { name: data.category } }),
    ])
  );
  if (!parish || !category) {
    return NextResponse.json({ error: "Invalid parish/category" }, { status: 400 });
  }

  const subcategory = await withRetry(() =>
    prisma.subcategory.findFirst({
      where: { name: data.subcategory, categoryId: category.id },
    })
  );
  if (!subcategory) {
    return NextResponse.json({ error: "Invalid subcategory for selected category" }, { status: 400 });
  }

  const existingMediaById = new Map(listing.media.map((m) => [m.id, m]));
  const removeMediaIds = [...new Set(data.removeMediaIds)];
  if (removeMediaIds.some((mediaId) => !existingMediaById.has(mediaId))) {
    return NextResponse.json({ error: "Invalid media selected for removal" }, { status: 400 });
  }

  const keptExisting = listing.media.filter((m) => !removeMediaIds.includes(m.id));
  const newPhotoCount = data.mediaUrls.filter((m) => m.type === "photo").length;
  const keptPhotoCount = keptExisting.filter((m) => m.type === "photo").length;
  if (keptPhotoCount + newPhotoCount > MAX_PHOTOS) {
    return NextResponse.json({ error: `You can keep/upload up to ${MAX_PHOTOS} photos.` }, { status: 400 });
  }

  const mediaOrderRefs = data.mediaOrderRefs.length
    ? data.mediaOrderRefs
    : [
        ...keptExisting.map((m) => `existing:${m.id}`),
        ...data.mediaUrls.map((m) => `new:${m.clientId}`),
      ];

  const expectedRefs = new Set([
    ...keptExisting.map((m) => `existing:${m.id}`),
    ...data.mediaUrls.map((m) => `new:${m.clientId}`),
  ]);
  if (mediaOrderRefs.length !== expectedRefs.size) {
    return NextResponse.json({ error: "Invalid media order" }, { status: 400 });
  }
  if (new Set(mediaOrderRefs).size !== mediaOrderRefs.length) {
    return NextResponse.json({ error: "Invalid media order" }, { status: 400 });
  }
  if (mediaOrderRefs.some((ref) => !expectedRefs.has(ref))) {
    return NextResponse.json({ error: "Invalid media order" }, { status: 400 });
  }

  const updatedListing = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          askingPrice: data.askingPrice ?? null,
          parishId: parish.id,
          categoryId: category.id,
          subcategoryId: subcategory.id,
        },
      });

      if (removeMediaIds.length > 0) {
        await tx.listingMedia.deleteMany({ where: { id: { in: removeMediaIds } } });
      }

      const newMediaIdByClientId = new Map<string, string>();
      for (const media of data.mediaUrls) {
        const created = await tx.listingMedia.create({
          data: {
            listingId: id,
            type: media.type,
            url: media.url,
            sizeBytes: media.sizeBytes,
            sortOrder: 0,
          },
          select: { id: true },
        });
        newMediaIdByClientId.set(media.clientId, created.id);
      }

      for (let order = 0; order < mediaOrderRefs.length; order += 1) {
        const ref = mediaOrderRefs[order];
        let mediaId: string | null = null;
        if (ref.startsWith("existing:")) {
          mediaId = ref.slice("existing:".length);
        } else if (ref.startsWith("new:")) {
          mediaId = newMediaIdByClientId.get(ref.slice("new:".length)) ?? null;
        }
        if (!mediaId) {
          throw new Error("Invalid media order");
        }
        await tx.listingMedia.update({
          where: { id: mediaId },
          data: { sortOrder: order },
        });
      }

      return tx.listing.findUnique({
        where: { id },
        include: {
          media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          parish: true,
          category: true,
          subcategory: true,
        },
      });
    })
  );

  return NextResponse.json({ listing: updatedListing });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const listing = await withRetry(() => prisma.listing.findUnique({ where: { id } }));
  if (!listing || listing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // "removed" listings were hidden by an admin (e.g. after a report) — block
  // the owner's self-archive path so they can't route through /restore to
  // undo that. Everything else (active/expired/sold) can still be archived.
  if (listing.status === "removed") {
    return NextResponse.json({ error: "This ad was removed by a moderator and can't be edited" }, { status: 400 });
  }
  if (listing.status === "deleted" || listing.status === "archived") {
    return NextResponse.json({ error: "Ad already archived or deleted" }, { status: 400 });
  }

  const archived = await withRetry(() =>
    prisma.listing.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: new Date(),
      },
    })
  );
  return NextResponse.json({ listing: archived });
}
