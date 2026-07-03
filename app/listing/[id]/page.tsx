"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const [sellerContact, setSellerContact] = useState<{ email: string; phone: string | null } | null>(null);

  async function load() {
    const res = await fetch(`/api/listings/${id}`);
    const data = await res.json();
    setListing(data.listing);
  }

  useEffect(() => { load(); }, [id]);

  if (!listing) return <div className="wrap">Loading…</div>;

  const highBid = listing.bids.length ? Math.max(...listing.bids.map((b: any) => b.amount)) : listing.minBid;
  const bidOpen = listing.biddingEnabled && listing.status === "active" &&
    (!listing.bidEndAt || new Date(listing.bidEndAt) > new Date());

  async function placeBid() {
    setError("");
    const res = await fetch(`/api/listings/${id}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(bidAmount) }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Could not place bid"); return; }
    setBidAmount("");
    load();
  }

  async function buyNow() {
    const res = await fetch(`/api/listings/${id}/buy-now`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Could not complete purchase"); return; }
    setSellerContact(data.sellerContact);
    load();
  }

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <div className="panel" style={{ maxWidth: "none" }}>
        {listing.media[0] && (
          <img
            src={listing.media[0].url}
            alt={listing.title}
            style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 4, marginBottom: 16 }}
          />
        )}
        <h2>{listing.title}</h2>
        <p className="note">{listing.subcategory.name} · {listing.parish.name}</p>
        <p>{listing.description}</p>
        <p className="mono" style={{ fontSize: 18, color: "var(--teal)" }}>
          Buy now: J${listing.buyNowPrice.toLocaleString()}
        </p>

        {listing.status === "sold" && <p className="error">This item has been sold.</p>}

        {listing.biddingEnabled && (
          <div className="bidbox" style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 8px" }}>
              Highest bid: <span className="hi">J${(highBid ?? 0).toLocaleString()}</span>
            </p>
            {bidOpen ? (
              <>
                <div className="field">
                  <label>Your bid (J$100 increments)</label>
                  <input value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} type="number" step={100} />
                </div>
                <button onClick={placeBid}>Place bid</button>
              </>
            ) : (
              <p className="note">Bidding has closed.</p>
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {listing.status === "active" && <button className="secondary" onClick={buyNow}>Buy now</button>}

        {sellerContact && (
          <div className="demo-note" style={{ marginTop: 16 }}>
            <p style={{ margin: "0 0 4px" }}>Seller email: {sellerContact.email}</p>
            {sellerContact.phone
              ? <p style={{ margin: "0 0 4px" }}>Seller phone: {sellerContact.phone}</p>
              : <p style={{ margin: "0 0 4px" }} className="note">Seller hasn't added a phone number — reach out by email.</p>}
            <p style={{ margin: 0 }}>2ndLife doesn't process the item payment itself — arrange that directly with the seller.</p>
          </div>
        )}
      </div>
    </div>
  );
}
