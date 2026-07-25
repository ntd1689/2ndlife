import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

// Served by Next at /sitemap.xml. Lists the public static pages plus every
// live, approved listing so search engines can discover and re-crawl them.
export const revalidate = 3600; // regenerate at most hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/changelog`, changeFrequency: "weekly", priority: 0.3 },
  ];

  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const listings = await prisma.listing.findMany({
      where: { status: "active", reviewStatus: "approved" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    listingRoutes = listings.map((l) => ({
      url: `${SITE_URL}/listing/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {
    // If the DB is briefly unreachable, still return the static sitemap rather
    // than failing the whole route.
  }

  return [...staticRoutes, ...listingRoutes];
}
