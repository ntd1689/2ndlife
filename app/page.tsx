import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { getSettings } from "@/lib/settings";
import { activeTier } from "@/lib/premium";
import { getSessionUserId } from "@/lib/auth";
import FavoriteButton from "./components/FavoriteButton";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; parish?: string; category?: string; subcategory?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSettings();

  const listings = await prisma.listing.findMany({
    where: {
      status: "active",
      title: params.q ? { contains: params.q, mode: "insensitive" } : undefined,
      parish: params.parish ? { name: params.parish } : undefined,
      category: params.category ? { name: params.category } : undefined,
      subcategory: params.subcategory ? { name: params.subcategory } : undefined,
    },
    include: {
      media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      parish: true,
      category: true,
      subcategory: true,
      offers: { orderBy: { amount: "desc" }, take: 1, select: { amount: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { featured: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  // Which of these ads has the signed-in viewer favorited?
  const viewerId = await getSessionUserId();
  let favoritedIds = new Set<string>();
  if (viewerId && listings.length > 0) {
    const favorites = await prisma.favorite.findMany({
      where: { userId: viewerId, listingId: { in: listings.map((l) => l.id) } },
      select: { listingId: true },
    });
    favoritedIds = new Set(favorites.map((f) => f.listingId));
  }

  const featured = listings.filter((l) => l.featured);
  const rest = listings.filter((l) => !l.featured);

  return (
    <div className="wrap">
      <h2 style={{ fontSize: 36 }}>Give your items a second life.</h2>
      <p className="tagline">
        Sell it, rent it, or bid for it — second hand, second chance. Free for the first {settings.freeAdDays} days.
      </p>

      {params.q && (
        <p className="note-light" style={{ marginTop: 10 }}>
          Showing results for “{params.q}” — <Link href="/" style={{ textDecoration: "underline" }}>clear search</Link>
        </p>
      )}

      {featured.length > 0 && (
        <>
          <div className="section-label"><span className="tag">Featured</span><h3>Top of the board</h3></div>
          <div className="grid">
            {featured.map((l) => <ListingCard key={l.id} listing={l} favorited={favoritedIds.has(l.id)} />)}
          </div>
        </>
      )}

      <div className="section-label">
        <span className="tag">Browse</span>
        <h3>{params.subcategory || params.category || "All ads"}</h3>
      </div>
      <div className="grid">
        {rest.map((l) => <ListingCard key={l.id} listing={l} favorited={favoritedIds.has(l.id)} />)}
        {listings.length === 0 && <p className="note-light">No ads match yet.</p>}
      </div>
    </div>
  );
}

function ListingCard({ listing: l, favorited }: { listing: any; favorited: boolean }) {
  const highOffer = l.offers[0]?.amount ?? null;
  const tier = activeTier(l);
  // Thumbnails must be photos — videos can't go through the image optimizer.
  const photo = l.media.find((m: any) => m.type === "photo");
  const video = photo ? null : l.media.find((m: any) => m.type === "video");
  return (
    <div className="card-wrap">
      <FavoriteButton listingId={l.id} initialFavorited={favorited} />
      <Link href={`/listing/${l.id}`} className="card">
        <span className="pin" />
        {tier === "vip" ? (
          <span className="ribbon vip">★ VIP AD</span>
        ) : tier === "top" ? (
          <span className="ribbon top">TOP AD</span>
        ) : l.featured ? (
          <span className="ribbon">FEATURED</span>
        ) : null}
        {photo && (
          <Image
            src={photo.url}
            alt={l.title}
            width={440}
            height={260}
            sizes="(max-width: 640px) 90vw, 220px"
          />
        )}
        {video && <video src={video.url} muted preload="metadata" />}
        <h4>{l.title}</h4>
        <div className="price">
          {l.askingPrice != null ? <>Asking J${l.askingPrice.toLocaleString()}</> : <>Open to offers</>}
        </div>
        <div className="meta"><span>{l.subcategory.name} · {l.parish.name}</span></div>
        {highOffer != null && (
          <div className="bidbox">Highest offer: <span className="hi">J${highOffer.toLocaleString()}</span></div>
        )}
      </Link>
    </div>
  );
}
