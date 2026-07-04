import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; parish?: string; category?: string; subcategory?: string }>;
}) {
  const params = await searchParams;

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

      {params.q && (
        <p className="note-light" style={{ marginTop: 10 }}>
          Showing results for “{params.q}” — <Link href="/" style={{ textDecoration: "underline" }}>clear search</Link>
        </p>
      )}

      {featured.length > 0 && (
        <>
          <div className="section-label"><span className="tag">Featured</span><h3>Top of the board</h3></div>
          <div className="grid">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </>
      )}

      <div className="section-label">
        <span className="tag">Browse</span>
        <h3>{params.subcategory || params.category || "All ads"}</h3>
      </div>
      <div className="grid">
        {rest.map((l) => <ListingCard key={l.id} listing={l} />)}
        {listings.length === 0 && <p className="note-light">No listings match yet.</p>}
      </div>
    </div>
  );
}

function ListingCard({ listing: l }: { listing: any }) {
  const highOffer = l.offers[0]?.amount ?? null;
  return (
    <Link href={`/listing/${l.id}`} className="card">
      <span className="pin" />
      {l.featured && <span className="ribbon">FEATURED</span>}
      {l.media[0] && <img src={l.media[0].url} alt={l.title} />}
      <h4>{l.title}</h4>
      <div className="price">
        {l.askingPrice != null ? <>Asking J${l.askingPrice.toLocaleString()}</> : <>Open to offers</>}
      </div>
      <div className="meta"><span>{l.subcategory.name} · {l.parish.name}</span></div>
      {highOffer != null && (
        <div className="bidbox">Highest offer: <span className="hi">J${highOffer.toLocaleString()}</span></div>
      )}
    </Link>
  );
}
