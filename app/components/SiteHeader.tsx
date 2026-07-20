import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { getAdminEmails } from "@/lib/env";
import MarketplaceNav, { NavCategory, NavNotification, NavUser } from "./MarketplaceNav";

export default async function SiteHeader() {
  const userId = await getSessionUserId();

  const [userRow, categoryRows, spotlightRows] = await Promise.all([
    userId
      ? withRetry(() =>
          prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, userType: true } })
        )
      : Promise.resolve(null),
    withRetry(() =>
      prisma.category.findMany({
        select: {
          name: true,
          _count: { select: { listings: { where: { status: "active", reviewStatus: "approved" } } } },
          subcategories: {
            select: {
              name: true,
              _count: { select: { listings: { where: { status: "active", reviewStatus: "approved" } } } },
            },
          },
        },
      })
    ),
    // Pool for the mega menu spotlight cards: featured first, then newest
    withRetry(() =>
      prisma.listing.findMany({
        where: { status: "active", reviewStatus: "approved" },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          askingPrice: true,
          featured: true,
          category: { select: { name: true } },
          media: {
            where: { type: "photo" },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1,
            select: { url: true },
          },
        },
        take: 40,
      })
    ),
  ]);

  const spotlightByCategory = new Map<string, { id: string; title: string; askingPrice: number | null; image: string | null }[]>();
  for (const l of spotlightRows) {
    const list = spotlightByCategory.get(l.category.name) ?? [];
    if (list.length < 2) {
      list.push({ id: l.id, title: l.title, askingPrice: l.askingPrice, image: l.media[0]?.url ?? null });
      spotlightByCategory.set(l.category.name, list);
    }
  }

  const categories: NavCategory[] = categoryRows
    .map((c) => ({
      name: c.name,
      count: c._count.listings,
      subcategories: c.subcategories
        .map((s) => ({ name: s.name, count: s._count.listings }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      spotlight: spotlightByCategory.get(c.name) ?? [],
    }))
    // Popularity order, "Other" pinned last
    .sort((a, b) => {
      if (a.name === "Other") return 1;
      if (b.name === "Other") return -1;
      return b.count - a.count || a.name.localeCompare(b.name);
    });

  let notifications: NavNotification[] = [];
  if (userId) {
    const pendingOffers = await withRetry(() =>
      prisma.offer.findMany({
        where: { acceptedAt: null, listing: { userId, status: "active" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          listing: { select: { title: true } },
        },
        take: 8,
      })
    );
    notifications = pendingOffers.map((o) => ({
      id: o.id,
      amount: o.amount,
      listingTitle: o.listing.title,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  const userIsAdmin = !!userRow && getAdminEmails().has(userRow.email.toLowerCase());
  const user: NavUser | null = userRow
    ? { email: userRow.email, isAdmin: userIsAdmin, isReviewer: userIsAdmin || userRow.userType === "ads_reviewer" }
    : null;

  return <MarketplaceNav user={user} categories={categories} notifications={notifications} />;
}
