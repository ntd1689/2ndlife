"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CategoryBreadcrumb from "../../components/CategoryBreadcrumb";
import MarkdownText from "../../components/MarkdownText";
import FavoriteButton from "../../components/FavoriteButton";

function isPremium(l: { premiumTier?: string; premiumUntil?: string | null }): "top" | "vip" | null {
  if (!l.premiumTier || l.premiumTier === "none" || !l.premiumUntil) return null;
  if (new Date(l.premiumUntil).getTime() < Date.now()) return null;
  return l.premiumTier as "top" | "vip";
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<any>(null);
  const [viewer, setViewer] = useState<{ offerAccepted: boolean; sellerContact: { email: string; phone: string | null } | null; isFavorited: boolean; isOwner: boolean }>({ offerAccepted: false, sellerContact: null, isFavorited: false, isOwner: false });
  const [activeMedia, setActiveMedia] = useState(0);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerSent, setOfferSent] = useState(false);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [reportError, setReportError] = useState("");

  async function load() {
    const res = await fetch(`/api/listings/${id}`);
    const data = await res.json();
    setListing(data.listing);
    if (data.viewer) setViewer(data.viewer);
  }

  useEffect(() => { load(); }, [id]);

  if (!listing) {
    return (
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="note-light">Loading…</p>
      </div>
    );
  }

  const media: { id: string; url: string; type: "photo" | "video" }[] = listing.media;
  const current = media[activeMedia] ?? media[0];
  const highOffer = listing.offers.length ? listing.offers[0].amount : null;
  const offersOpen = listing.status === "active" &&
    (!listing.offerEndAt || new Date(listing.offerEndAt) > new Date());

  async function makeOffer() {
    setError("");
    const res = await fetch(`/api/listings/${id}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(offerAmount) }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Could not send your offer"); return; }
    setOfferAmount("");
    setOfferSent(true);
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
      <CategoryBreadcrumb category={listing.category.name} subcategory={listing.subcategory.name} />

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
          {isPremium(listing) === "vip" && <span className="tag tier-vip">★ VIP AD</span>}
          {isPremium(listing) === "top" && <span className="tag tier-top">TOP AD</span>}
          {listing.status === "sold" && <span className="note">This item has been sold</span>}
          <span style={{ marginLeft: "auto" }}>
            <FavoriteButton listingId={listing.id} initialFavorited={viewer.isFavorited} variant="inline" />
          </span>
        </div>
        <h2 style={{ marginTop: 8 }}>{listing.title}</h2>
        <p className="note">
          {listing.subcategory.name} · {listing.parish.name}
          {typeof listing.uniqueViews === "number" && <> · 👁 {listing.uniqueViews} unique view{listing.uniqueViews === 1 ? "" : "s"}</>}
        </p>

        <MarkdownText text={listing.description} className="description" />

        {listing.instagramUrl && (
          <p className="note" style={{ marginTop: 8 }}>
            <a href={listing.instagramUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              View on Instagram / website ↗
            </a>
          </p>
        )}

        <p className="mono price-lg">
          {listing.askingPrice ? <>Asking: J${listing.askingPrice.toLocaleString()}</> : <>Open to offers</>}
        </p>

        <div className="bidbox">
          <p style={{ margin: "0 0 8px" }}>
            {highOffer != null ? (
              <>
                Highest offer: <span className="hi">J${highOffer.toLocaleString()}</span>
                <span className="note"> · {listing.offers.length} offer{listing.offers.length === 1 ? "" : "s"} so far</span>
              </>
            ) : (
              <>No offers yet{offersOpen && !viewer.isOwner ? " — be the first" : ""}.</>
            )}
          </p>
          {viewer.isOwner ? (
            <p className="note">This is your ad — you can review and accept offers from My Ads.</p>
          ) : offersOpen ? (
            <>
              <div className="field">
                <label>
                  Your offer (J$){highOffer != null ? ` — must be more than J$${highOffer.toLocaleString()}` : ""}
                </label>
                <input value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} type="number" min={1} />
              </div>
              <button onClick={makeOffer}>Make an offer</button>
              {offerSent && !error && (
                <p className="note" style={{ marginTop: 8 }}>
                  Offer sent — the seller will see it and can accept it. You'll get an email if they do.
                </p>
              )}
              {listing.offerEndAt && (
                <p className="note" style={{ marginTop: 8 }}>
                  Offers close {new Date(listing.offerEndAt).toLocaleDateString()}.
                </p>
              )}
            </>
          ) : (
            <p className="note">
              {listing.status === "sold" ? "This item has been sold." : "Offers have closed on this ad."}
            </p>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        {viewer.offerAccepted && viewer.sellerContact && (
          <div className="demo-note" style={{ marginTop: 16 }}>
            <p style={{ margin: "0 0 4px" }}><b>Your offer was accepted!</b></p>
            <p style={{ margin: "0 0 4px" }}>Seller email: {viewer.sellerContact.email}</p>
            {viewer.sellerContact.phone
              ? <p style={{ margin: "0 0 4px" }}>Seller phone: {viewer.sellerContact.phone}</p>
              : <p style={{ margin: "0 0 4px" }} className="note">Seller hasn't added a phone number — reach out by email.</p>}
            <p style={{ margin: 0 }}>2ndLife doesn't process the item payment itself — arrange that directly with the seller.</p>
          </div>
        )}

        <div className="detail-footer">
          {viewer.isOwner ? null : reportStatus === "sent" ? (
            <p className="note">Thanks — this ad has been reported to our team.</p>
          ) : reportOpen ? (
            <div className="field">
              <label>Why are you reporting this ad?</label>
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
            <button className="ghost" onClick={() => setReportOpen(true)}>Report this ad</button>
          )}
        </div>
      </div>
    </div>
  );
}
