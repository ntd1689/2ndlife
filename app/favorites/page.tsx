"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FavoriteButton from "../components/FavoriteButton";

type Listing = {
  id: string;
  title: string;
  askingPrice: number | null;
  media: { url: string; type: "photo" | "video" }[];
  parish: { name: string };
  subcategory: { name: string };
  offers: { amount: number }[];
};

export default function FavoritesPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/me/favorites");
      if (res.status === 401) {
        setNeedsLogin(true);
        setListings([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load your favorites");
        setListings([]);
        return;
      }
      setListings(data.listings);
    } catch {
      setError("Network issue while loading your favorites.");
      setListings([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Drop a card from the list the moment it's unfavorited.
  function handleChange(id: string, favorited: boolean) {
    if (!favorited) setListings((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
  }

  return (
    <div className="wrap">
      <h2 style={{ fontSize: 30 }}>Your favorites</h2>
      {error && <p className="error">{error}</p>}

      {needsLogin ? (
        <p className="note-light" style={{ marginTop: 10 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to save and view your favorite ads.
        </p>
      ) : listings === null ? (
        <p className="note-light">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="note-light" style={{ marginTop: 10 }}>
          No favorites yet. Tap the ♡ on any ad to save it here.
        </p>
      ) : (
        <div className="grid" style={{ marginTop: 16 }}>
          {listings.map((l) => {
            const highOffer = l.offers[0]?.amount ?? null;
            return (
              <div className="card-wrap" key={l.id}>
                <FavoriteButton
                  listingId={l.id}
                  initialFavorited={true}
                  onChange={(fav) => handleChange(l.id, fav)}
                />
                <Link href={`/listing/${l.id}`} className="card">
                  <span className="pin" />
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
