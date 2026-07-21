import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { MAX_PHOTOS } from "@/lib/data/categories";
import { getSettings } from "@/lib/settings";
import { sendAdPendingEmail } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const parish = searchParams.get("parish") || undefined;
  const category = searchParams.get("category") || undefined;
  const subcategory = searchParams.get("subcategory") || undefined;

  const listings = await withRetry(() =>
    prisma.listing.findMany({
      where: {
        status: "active",
        reviewStatus: "approved",
        title: q ? { contains: q, mode: "insensitive" } : undefined,
        parish: parish ? { name: parish } : undefined,
        category: category ? { name: category } : undefined,
        subcategory: subcategory ? { name: subcategory } : undefined,
      },
      include: {
        media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        parish: true,
        category: true,
        subcategory: true,
        offers: { orderBy: { amount: "desc" }, select: { amount: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { featured: "desc" }, { createdAt: "desc" }],
    })
  );

  return NextResponse.json({ listings });
}

const createSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(1, "Please add a description"),
  instagramUrl: z.string().url("Instagram / website must be a full URL (https://…)").optional().or(z.literal("")),
  parish: z.string(),
  category: z.string(),
  subcategory: z.string(),
  askingPrice: z.number().int().positive().optional(),
  offerDays: z.number().int().min(1).max(7).optional(),
  plan: z.enum(["free", "unlimited"]).default("free"),
  featured: z.boolean().default(false),
  mediaUrls: z.array(z.object({ type: z.enum(["photo", "video"]), url: z.string(), sizeBytes: z.number() })),
});

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  // Honeypot: silently drop bot submissions that fill the hidden field.
  if (typeof body?.honeypot === "string" && body.honeypot.trim()) {
    return NextResponse.json({ error: "Could not publish ad" }, { status: 400 });
  }

  const ip = clientIp(req);
  if (!(await verifyTurnstile(body?.turnstileToken, ip))) {
    return NextResponse.json({ error: "Please complete the verification and try again." }, { status: 400 });
  }

  // Cap ad creation per network to blunt mass posting even from many accounts.
  const postLimit = await rateLimit(`listing:create:ip:${ip}`, 12, 60 * 60 * 1000);
  if (!postLimit.allowed) {
    return NextResponse.json(
      { error: "You're posting ads too quickly. Please try again later." },
      { status: 429, headers: { "Retry-After": String(postLimit.retryAfterSec) } }
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ad details" }, { status: 400 });
  }
  const data = parsed.data;

  const photoCount = data.mediaUrls.filter((m) => m.type === "photo").length;
  if (photoCount > MAX_PHOTOS) {
    return NextResponse.json({ error: `You can upload up to ${MAX_PHOTOS} photos.` }, { status: 400 });
  }

  const [parish, category, subcategory] = await withRetry(() =>
    Promise.all([
      prisma.parish.findUnique({ where: { name: data.parish } }),
      prisma.category.findUnique({ where: { name: data.category } }),
      prisma.subcategory.findFirst({ where: { name: data.subcategory, category: { name: data.category } } }),
    ])
  );
  if (!parish || !category || !subcategory) {
    return NextResponse.json({ error: "Invalid parish/category/subcategory" }, { status: 400 });
  }

  const now = new Date();
  const { freeAdDays } = await getSettings();
  const expiresAt = data.plan === "free" ? new Date(now.getTime() + freeAdDays * 86400000) : null;
  const offerEndAt = data.offerDays ? new Date(now.getTime() + data.offerDays * 86400000) : null;

  const listing = await withRetry(() =>
    prisma.listing.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        instagramUrl: data.instagramUrl || null,
        parishId: parish.id,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        askingPrice: data.askingPrice ?? null,
        offerEndAt,
        plan: data.plan,
        featured: data.featured,
        expiresAt,
        // New ads enter the moderation queue and stay hidden until approved.
        reviewStatus: "pending",
        submittedAt: now,
        media: {
          create: data.mediaUrls.map((m, index) => ({
            type: m.type,
            url: m.url,
            sizeBytes: m.sizeBytes,
            sortOrder: index,
          })),
        },
      },
      include: { media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    })
  );

  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (owner) await sendAdPendingEmail(owner.email, { id: listing.id, title: listing.title }, false);

  return NextResponse.json({ listing });
}
