import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Served by Next at /robots.txt. Public browse + listing pages are open to
// crawlers; account, checkout, moderation, and API routes are kept out of the
// index — they're either private, thin, or not useful as search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/my-ads",
        "/favorites",
        "/profile",
        "/payments",
        "/review",
        "/post",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
