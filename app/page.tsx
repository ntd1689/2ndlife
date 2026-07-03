import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; parish?: string; category?: string };
}) {
  const listings = await prisma.listing.findMany({
    where: {
      status: "active",
      title: searchParams.q ? { contains: searchParams.q, mode: "insensitive" } : undefined,
      parish: searchParams.parish ? { name: searchParams.parish } : undefined,
      category: searchParams.category ? { name: searchParams.category } : undefined,
    },
    include: {
      media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      parish: true,
      category: true,
      subcategory: true,
      bids: true,
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  const featured = listings.filter((l) => l.featured);
  const rest = listings.filter((l) => !l.featured);

  return (
    <div className="wrap">
      <h2 style={{ fontSize: 36 }}>Give your items a second life.</h2>
      <p className="tagline">
        Sell it, rent it, or bid for it — second hand, second chance. Free for the first 7 days.
      </p>

      <form className="searchrow">
        <input name="q" placeholder="Search listings…" defaultValue={searchParams.q} />
        <button type="submit">Search</button>
      </form>

      {featured.length > 0 && (
        <>
          <div className="section-label"><span className="tag">Featured</span><h3>Top of the board</h3></div>
          <div className="grid">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </>
      )}

      <div className="section-label"><span className="tag">Browse</span><h3>All listings</h3></div>
      <div className="grid">
        {rest.map((l) => <ListingCard key={l.id} listing={l} />)}
        {listings.length === 0 && <p className="note-light">No listings match yet.</p>}
      </div>
    </div>
  );
}

function ListingCard({ listing: l }: { listing: any }) {
  const highBid = l.bids.length ? Math.max(...l.bids.map((b: any) => b.amount)) : l.minBid;
  return (
    <Link href={`/listing/${l.id}`} className="card">
      <span className="pin" />
      {l.featured && <span className="ribbon">FEATURED</span>}
      {l.media[0] && <img src={l.media[0].url} alt={l.title} />}
      <h4>{l.title}</h4>
      <div className="price">Buy now J${l.buyNowPrice.toLocaleString()}</div>
      <div className="meta"><span>{l.subcategory.name} · {l.parish.name}</span></div>
      {l.biddingEnabled && (
        <div className="bidbox">Highest bid: <span className="hi">J${(highBid ?? 0).toLocaleString()}</span></div>
      )}
    </Link>
  );
}
