import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL, toMetaDescription } from "@/lib/seo";

// The listing page itself is an interactive client component, so it can't
// produce server-rendered metadata. This server layout fills that gap: it
// fetches the listing on the server to emit a per-ad <title>, description,
// canonical URL, OpenGraph/Twitter image, and Product structured data — the
// things search engines and social previews read. Private/removed ads are
// marked noindex so they don't linger in results.

type PublicListing = {
  id: string;
  title: string;
  description: string;
  askingPrice: number | null;
  status: string;
  reviewStatus: string;
  category: { name: string };
  subcategory: { name: string };
  parish: { name: string };
  media: { url: string; type: string }[];
};

async function getListing(id: string): Promise<PublicListing | null> {
  try {
    return await prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        askingPrice: true,
        status: true,
        reviewStatus: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        parish: { select: { name: true } },
        media: {
          where: { type: "photo" },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { url: true, type: true },
        },
      },
    });
  } catch {
    return null;
  }
}

function isPublic(l: PublicListing): boolean {
  return l.reviewStatus === "approved" && ["active", "sold"].includes(l.status);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing || !isPublic(listing)) {
    // Not a public ad — keep it out of the index.
    return { title: "Ad not available", robots: { index: false, follow: false } };
  }

  const price =
    listing.askingPrice != null
      ? `Asking J$${listing.askingPrice.toLocaleString()}`
      : "Open to offers";
  const where = `${listing.subcategory.name} in ${listing.parish.name}, Jamaica`;
  const description = toMetaDescription(
    `${price} · ${where}. ${listing.description}`
  );
  const url = `${SITE_URL}/listing/${listing.id}`;
  const images = listing.media.slice(0, 4).map((m) => m.url);

  return {
    title: listing.title,
    description,
    alternates: { canonical: `/listing/${listing.id}` },
    openGraph: {
      type: "website",
      title: listing.title,
      description,
      url,
      images: images.length ? images : ["/icon-512.png"],
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: listing.title,
      description,
      images: images.length ? images : ["/icon-512.png"],
    },
  };
}

export default async function ListingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);

  // Product structured data helps this ad qualify for rich results in search.
  let jsonLd: Record<string, unknown> | null = null;
  if (listing && isPublic(listing)) {
    const url = `${SITE_URL}/listing/${listing.id}`;
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      description: toMetaDescription(listing.description, 300),
      category: listing.category.name,
      image: listing.media.slice(0, 4).map((m) => m.url),
      url,
    };
    if (listing.askingPrice != null) {
      jsonLd.offers = {
        "@type": "Offer",
        price: listing.askingPrice,
        priceCurrency: "JMD",
        availability:
          listing.status === "sold"
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
        url,
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
