"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<any>(null);
  const [activeMedia, setActiveMedia] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const [sellerContact, setSellerContact] = useState<{ email: string; phone: string | null } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [reportError, setReportError] = useState("");

  async function load() {
    const res = await fetch(`/api/listings/${id}`);
    const data = await res.json();
    setListing(data.listing);
  }

  useEffect(() => { load(); }, [id]);

  if (!listing) return <div className="wrap">Loading…</div>;

  const media: { id: string; url: string; type: "photo" | "video" }[] = listing.media;
  const current = media[activeMedia] ?? media[0];
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

  async function submitReport() {
    setReportError("");
    if (reportReason.trim().length < 5) {
      setReportError("Tell us a bit more about the issue (at least 5 characters)");
      return;
    }
    setReportStatus("sending");
    try {
      const res = await fetch(`/api/listings/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason }),
      });
      const data = await res.json();
      if (!res.ok) { setReportError(data.error || "Could not send report"); setReportStatus("idle"); return; }
      setReportStatus("sent");
    } catch {
      setReportError("Network issue while sending report. Please try again.");
      setReportStatus("idle");
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <div className="panel" style={{ maxWidth: "none" }}>
        {media.length > 0 && current && (
          <div className="gallery">
            {listing.status === "sold" && <span className="ribbon sold">SOLD</span>}
            {listing.featured && listing.status !== "sold" && <span className="ribbon">FEATURED</span>}
            {current.type === "video" ? (
              <video src={current.url} className="main-media" controls preload="metadata" />
            ) : (
              <img src={current.url} alt={listing.title} className="main-media" />
            )}
            {media.length > 1 && (
              <div className="thumbs">
                {media.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    className={i === activeMedia ? "active" : ""}
                    onClick={() => setActiveMedia(i)}
                  >
                    {m.type === "video" ? (
                      <video src={m.url} muted preload="metadata" />
                    ) : (
                      <img src={m.url} alt="" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="detail-title-row">
          <span className="tag">{listing.category.name}</span>
          {listing.status === "sold" && <span className="note">This item has been sold</span>}
        </div>
        <h2 style={{ marginTop: 8 }}>{listing.title}</h2>
        <p className="note">{listing.subcategory.name} · {listing.parish.name}</p>

        <p className="description">{listing.description}</p>

        {listing.instagramUrl && (
          <p className="note" style={{ marginTop: 8 }}>
            <a href={listing.instagramUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              View on Instagram / website ↗
            </a>
          </p>
        )}

        <p className="mono price-lg">Buy now: J${listing.buyNowPrice.toLocaleString()}</p>

        {listing.biddingEnabled && (
          <div className="bidbox">
            <p style={{ margin: "0 0 8px" }}>
              Highest bid: <span className="hi">J${(highBid ?? 0).toLocaleString()}</span>
              {listing.bids.length > 0 && (
                <span className="note"> · {listing.bids.length} bid{listing.bids.length === 1 ? "" : "s"} so far</span>
              )}
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

        <div className="detail-footer">
          {reportStatus === "sent" ? (
            <p className="note">Thanks — this listing has been reported to our team.</p>
          ) : reportOpen ? (
            <div className="field">
              <label>Why are you reporting this listing?</label>
              <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={3} />
              {reportError && <p className="error">{reportError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={submitReport} disabled={reportStatus === "sending"}>
                  {reportStatus === "sending" ? "Sending…" : "Submit report"}
                </button>
                <button className="ghost" onClick={() => setReportOpen(false)} disabled={reportStatus === "sending"}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="ghost" onClick={() => setReportOpen(true)}>Report this listing</button>
          )}
        </div>
      </div>
    </div>
  );
}
