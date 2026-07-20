"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CATEGORIES, ARCHIVE_WINDOW_DAYS, MAX_PHOTOS } from "@/lib/data/categories";
import { PARISHES } from "@/lib/data/parishes";
import DescriptionEditor from "../components/DescriptionEditor";
import MoneyInput from "../components/MoneyInput";
import { downscaleImage } from "@/lib/resize-image";
import MarkdownText from "../components/MarkdownText";
import PromoteDialog from "../components/PromoteDialog";

type MediaItem = {
  id: string;
  url: string;
  type: "photo" | "video";
  sortOrder: number;
};

type Offer = {
  id: string;
  amount: number;
  createdAt: string;
  acceptedAt: string | null;
};

type Listing = {
  id: string;
  title: string;
  description: string;
  askingPrice: number | null;
  status: "active" | "expired" | "archived" | "deleted" | "sold" | "removed";
  createdAt: string;
  archivedAt: string | null;
  parish: { name: string };
  category: { name: string };
  subcategory: { name: string };
  media: MediaItem[];
  offers: Offer[];
  uniqueViews?: number;
  premiumTier: "none" | "top" | "vip";
  premiumUntil: string | null;
  reviewStatus: "pending" | "approved" | "rejected" | "changes_requested";
  reviewNote: string | null;
};

type DraftMedia = {
  key: string;
  source: "existing" | "new";
  mediaId?: string;
  type: "photo" | "video";
  previewUrl: string;
  file?: File;
  sizeBytes: number;
  removed: boolean;
};

export default function MyAdsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveConfirmListing, setArchiveConfirmListing] = useState<Listing | null>(null);
  const [promoteListing, setPromoteListing] = useState<Listing | null>(null);
  const [promoNotice, setPromoNotice] = useState<"capturing" | "done" | "failed" | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [parish, setParish] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [draftMedia, setDraftMedia] = useState<DraftMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [actingListingId, setActingListingId] = useState<string | null>(null);
  const nextDraftId = useRef(1);
  const draftMediaRef = useRef<DraftMedia[]>([]);

  const subcategories = useMemo(() => CATEGORIES[category] ?? [], [category]);

  // The tier to show right now, accounting for expiry (mirrors lib/premium.ts).
  function activePremium(listing: Listing): "top" | "vip" | null {
    if (listing.premiumTier === "none" || !listing.premiumUntil) return null;
    if (new Date(listing.premiumUntil).getTime() < Date.now()) return null;
    return listing.premiumTier;
  }

  async function parseJsonSafe(res: Response): Promise<any> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/me/listings");
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error || "Could not load your ads");
        return;
      }
      setListings(data.listings);
    } catch {
      setError("Network issue while loading your ads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // If the buyer's browser blocked PayPal's popup, checkout falls back to a
  // full-page redirect and returns here as /my-ads?token=<orderId>. The
  // promote dialog is gone by then, so finish the capture from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("token");
    if (!orderId) return;
    window.history.replaceState({}, "", "/my-ads");
    setPromoNotice("capturing");
    (async () => {
      try {
        const res = await fetch("/api/payments/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        setPromoNotice(res.ok ? "done" : "failed");
        if (res.ok) load();
      } catch {
        setPromoNotice("failed");
      }
    })();
  }, []);

  useEffect(() => {
    draftMediaRef.current = draftMedia;
  }, [draftMedia]);

  useEffect(() => {
    return () => {
      draftMediaRef.current.forEach((m) => {
        if (m.source === "new") URL.revokeObjectURL(m.previewUrl);
      });
    };
  }, []);

  function resetDraftMedia(newDraftMedia: DraftMedia[]) {
    draftMedia.forEach((m) => {
      if (m.source === "new") URL.revokeObjectURL(m.previewUrl);
    });
    setDraftMedia(newDraftMedia);
  }

  function startEdit(listing: Listing) {
    setEditingId(listing.id);
    setTitle(listing.title);
    setDescription(listing.description);
    setPrice(listing.askingPrice != null ? String(listing.askingPrice) : "");
    setParish(listing.parish.name);
    setCategory(listing.category.name);
    setSubcategory(listing.subcategory.name);
    setError("");
    resetDraftMedia(
      [...listing.media]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((media) => ({
          key: `existing:${media.id}`,
          source: "existing",
          mediaId: media.id,
          type: media.type,
          previewUrl: media.url,
          sizeBytes: 0,
          removed: false,
        }))
    );
  }

  function stopEdit() {
    setEditingId(null);
    resetDraftMedia([]);
  }

  function activePhotoCount() {
    return draftMedia.filter((m) => !m.removed && m.type === "photo").length;
  }

  function addFiles(files: File[], type: "photo" | "video") {
    if (files.length === 0) return;

    if (type === "photo") {
      const allowed = Math.max(0, MAX_PHOTOS - activePhotoCount());
      if (files.length > allowed) {
        setError(`Only ${allowed} more photo${allowed === 1 ? "" : "s"} can be added (max ${MAX_PHOTOS}).`);
      }
      files = files.slice(0, allowed);
    }

    if (files.length === 0) return;

    const newItems = files.map((file) => {
      const key = `new:${nextDraftId.current}`;
      nextDraftId.current += 1;
      return {
        key,
        source: "new" as const,
        type,
        previewUrl: URL.createObjectURL(file),
        file,
        sizeBytes: file.size,
        removed: false,
      };
    });
    setDraftMedia((prev) => [...prev, ...newItems]);
  }

  function moveMedia(key: string, direction: "left" | "right") {
    setDraftMedia((prev) => {
      const active = prev.filter((m) => !m.removed);
      const removed = prev.filter((m) => m.removed);
      const idx = active.findIndex((m) => m.key === key);
      if (idx === -1) return prev;
      const target = direction === "left" ? idx - 1 : idx + 1;
      if (target < 0 || target >= active.length) return prev;
      const copy = [...active];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return [...copy, ...removed];
    });
  }

  function toggleRemoveMedia(key: string) {
    setDraftMedia((prev) =>
      prev.map((m) => (m.key === key ? { ...m, removed: !m.removed } : m))
    );
  }

  function removeNewMedia(key: string) {
    setDraftMedia((prev) => {
      const item = prev.find((m) => m.key === key);
      if (item?.source === "new") {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((m) => m.key !== key);
    });
  }

  async function uploadFile(file: File, type: "photo" | "video") {
    if (type === "photo") file = await downscaleImage(file);
    const ext = file.name.split(".").pop() || "bin";
    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, ext, sizeBytes: file.size, type }),
    });
    const presign = await presignRes.json();
    if (!presignRes.ok) throw new Error(presign.error || "Could not prepare file upload");

    const uploadRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) throw new Error(`Failed to upload ${type}`);

    return { type, url: presign.publicUrl, sizeBytes: file.size };
  }

  async function saveEdit() {
    if (!editingId) return;
    setError("");
    setSaving(true);
    try {
      if (!title || !description || !parish || !category || !subcategory) {
        setError("Fill in all required fields.");
        return;
      }
      if (price && (!Number(price) || Number(price) < 1)) {
        setError("Asking price must be a positive amount, or leave it blank for offers-only.");
        return;
      }

      const active = draftMedia.filter((m) => !m.removed);
      const removeMediaIds = draftMedia
        .filter((m) => m.source === "existing" && m.removed && m.mediaId)
        .map((m) => m.mediaId as string);

      const newItems = active.filter((m) => m.source === "new");
      const uploadedMedia = [];
      for (const media of newItems) {
        const uploaded = await uploadFile(media.file as File, media.type);
        uploadedMedia.push({
          clientId: media.key.slice("new:".length),
          ...uploaded,
        });
      }

      const mediaOrderRefs = active.map((m) =>
        m.source === "existing" ? `existing:${m.mediaId}` : `new:${m.key.slice("new:".length)}`
      );

      const res = await fetch(`/api/listings/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          askingPrice: price ? Number(price) : null,
          parish,
          category,
          subcategory,
          removeMediaIds,
          mediaUrls: uploadedMedia,
          mediaOrderRefs,
        }),
      });

      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error || "Could not update ad");
        return;
      }
      stopEdit();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update ad");
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchiveListing() {
    if (!archiveConfirmListing) return;
    setActingListingId(archiveConfirmListing.id);
    setError("");
    try {
      const res = await fetch(`/api/listings/${archiveConfirmListing.id}`, { method: "DELETE" });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error || "Could not archive ad");
        return;
      }
      setArchiveConfirmListing(null);
      await load();
    } catch {
      setError("Network issue while archiving this ad.");
    } finally {
      setActingListingId(null);
    }
  }

  async function restoreListing(id: string) {
    setActingListingId(id);
    setError("");
    try {
      const res = await fetch(`/api/listings/${id}/restore`, { method: "POST" });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error || "Could not restore ad");
        return;
      }
      await load();
    } catch {
      setError("Network issue while restoring this ad.");
    } finally {
      setActingListingId(null);
    }
  }

  function getRestoreDaysLeft(archivedAt: string | null): number {
    if (!archivedAt) return 0;
    const msInDay = 86400000;
    const cutoff = new Date(archivedAt).getTime() + ARCHIVE_WINDOW_DAYS * msInDay;
    return Math.max(0, Math.ceil((cutoff - Date.now()) / msInDay));
  }

  async function acceptOffer(offerId: string) {
    if (!confirm("Accept this offer? The ad will be marked sold and the buyer will be sent your contact info.")) return;
    setActingListingId(offerId);
    setError("");
    try {
      const res = await fetch(`/api/offers/${offerId}/accept`, { method: "POST" });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error || "Could not accept offer");
        return;
      }
      await load();
    } catch {
      setError("Network issue while accepting this offer.");
    } finally {
      setActingListingId(null);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 800 }}>
      <h1>Manage my ads</h1>
      {error && <p className="error">{error}</p>}
      {promoNotice === "capturing" && <p className="note-light">Finishing your PayPal payment…</p>}
      {promoNotice === "done" && <p className="note-light">Promotion active 🎉 — your ad's new placement is live.</p>}
      {promoNotice === "failed" && (
        <p className="error">
          We couldn't confirm your PayPal payment. If you completed checkout, it will be applied automatically
          within a few minutes — otherwise try promoting again.
        </p>
      )}
      {loading && <p className="note-light">Loading…</p>}

      {!loading && listings.length === 0 && (
        <div className="panel">
          <p>You have no ads yet.</p>
          <Link href="/post">
            <button>Post your first ad</button>
          </Link>
        </div>
      )}

      {listings.map((listing) => {
        const restoreDaysLeft = getRestoreDaysLeft(listing.archivedAt);
        const canRestore = listing.status === "archived" && restoreDaysLeft > 0;

        return (
          <div key={listing.id} className="panel" style={{ maxWidth: "none" }}>
            {listing.media.find((m) => m.type === "photo") && (
              <Image
                src={listing.media.find((m) => m.type === "photo")!.url}
                alt={listing.title}
                width={1280}
                height={440}
                sizes="(max-width: 768px) 100vw, 1050px"
                style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 4, marginBottom: 16 }}
              />
            )}

            <p className="note" style={{ marginTop: 0 }}>
              Status: <b>{listing.status}</b> · Created {new Date(listing.createdAt).toLocaleDateString()}
              {listing.status === "archived" && listing.archivedAt && (
                <> · Archived {new Date(listing.archivedAt).toLocaleDateString()}</>
              )}
            </p>
            {listing.status === "removed" && (
              <p className="error" style={{ marginTop: 0 }}>
                This ad was removed by a moderator and is no longer visible to buyers.
              </p>
            )}

            {editingId === listing.id ? (
              <>
                <div className="field">
                  <label>Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="field">
                  <label>Description</label>
                  <DescriptionEditor value={description} onChange={setDescription} />
                </div>
                <div className="field">
                  <label>Asking price (J$, optional)</label>
                  <MoneyInput value={price} onChange={setPrice} placeholder="Leave blank to just take offers" />
                </div>
                <div className="field">
                  <label>Parish</label>
                  <select value={parish} onChange={(e) => setParish(e.target.value)}>
                    <option value="">Select parish</option>
                    {PARISHES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubcategory("");
                    }}
                  >
                    <option value="">Select category</option>
                    {Object.keys(CATEGORIES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Subcategory</label>
                  <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                    <option value="">Select subcategory</option>
                    {subcategories.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Media order (drag-like controls)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                    {draftMedia.map((media, idx) => (
                      <div
                        key={media.key}
                        style={{
                          border: media.removed ? "2px dashed var(--rust)" : "1px solid #ddd",
                          borderRadius: 4,
                          padding: 8,
                          opacity: media.removed ? 0.5 : 1,
                        }}
                      >
                        {media.type === "video" ? (
                          <video src={media.previewUrl} style={{ width: "100%", height: 100, objectFit: "cover" }} />
                        ) : (
                          <img src={media.previewUrl} alt="Media preview" style={{ width: "100%", height: 100, objectFit: "cover" }} />
                        )}
                        <p className="note" style={{ margin: "6px 0" }}>
                          {media.source === "new" ? "New preview" : "Current media"} · {media.type}
                        </p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => moveMedia(media.key, "left")} disabled={idx === 0 || media.removed}>
                            ◀
                          </button>
                          <button
                            type="button"
                            onClick={() => moveMedia(media.key, "right")}
                            disabled={idx === draftMedia.length - 1 || media.removed}
                          >
                            ▶
                          </button>
                          {media.source === "existing" ? (
                            <button type="button" className="secondary" onClick={() => toggleRemoveMedia(media.key)}>
                              {media.removed ? "Undo remove" : "Remove"}
                            </button>
                          ) : (
                            <button type="button" className="secondary" onClick={() => removeNewMedia(media.key)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label>Add new photos (up to {MAX_PHOTOS} total photos)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => addFiles(Array.from(e.target.files ?? []), "photo")}
                  />
                </div>
                <div className="field">
                  <label>Add new videos</label>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={(e) => addFiles(Array.from(e.target.files ?? []), "video")}
                  />
                </div>

                <div className="btn-row">
                  <button onClick={saveEdit} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button className="secondary" onClick={stopEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>
                  {listing.title}
                  {activePremium(listing) === "vip" && <span className="tag tier-vip" style={{ marginLeft: 8 }}>★ VIP</span>}
                  {activePremium(listing) === "top" && <span className="tag tier-top" style={{ marginLeft: 8 }}>TOP</span>}
                </h3>
                {activePremium(listing) && listing.premiumUntil && (
                  <p className="note" style={{ margin: "0 0 6px" }}>
                    {activePremium(listing) === "vip" ? "VIP" : "Top"} placement until{" "}
                    {new Date(listing.premiumUntil).toLocaleDateString()}.
                  </p>
                )}

                {listing.reviewStatus !== "approved" && (
                  <div className={`review-banner review-${listing.reviewStatus}`}>
                    {listing.reviewStatus === "pending" && <b>⏳ Pending review</b>}
                    {listing.reviewStatus === "changes_requested" && <b>✏️ Changes requested</b>}
                    {listing.reviewStatus === "rejected" && <b>🚫 Not approved</b>}
                    <p style={{ margin: "4px 0 0" }}>
                      {listing.reviewStatus === "pending"
                        ? "Your ad is awaiting reviewer approval and isn't public yet."
                        : listing.reviewStatus === "changes_requested"
                          ? "A reviewer asked for changes. Edit and save your ad to resubmit it."
                          : "This ad wasn't approved. Edit and save it to submit for review again."}
                    </p>
                    {listing.reviewNote && (
                      <p style={{ margin: "6px 0 0" }}><b>Reviewer notes:</b> {listing.reviewNote}</p>
                    )}
                  </div>
                )}

                <MarkdownText text={listing.description} />
                <p className="mono">
                  {listing.askingPrice != null ? `Asking J$${listing.askingPrice.toLocaleString()}` : "Open to offers"}
                </p>
                <p className="note">
                  {listing.category.name} → {listing.subcategory.name} · {listing.parish.name}
                  {typeof listing.uniqueViews === "number" && <> · 👁 {listing.uniqueViews} unique view{listing.uniqueViews === 1 ? "" : "s"}</>}
                </p>

                {listing.status === "archived" && (
                  <p className="note">
                    {canRestore
                      ? `You can restore this ad for ${restoreDaysLeft} more day${restoreDaysLeft === 1 ? "" : "s"}.`
                      : "Restore window has ended for this archived ad."}
                  </p>
                )}

                {listing.offers.length > 0 && (
                  <div className="bidbox">
                    <p style={{ margin: "0 0 8px" }}><b>Offers ({listing.offers.length})</b></p>
                    {listing.offers.map((offer) => (
                      <div key={offer.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span className="hi">J${offer.amount.toLocaleString()}</span>
                        <span className="note">{new Date(offer.createdAt).toLocaleDateString()}</span>
                        {offer.acceptedAt ? (
                          <span className="tag">Accepted</span>
                        ) : listing.status === "active" ? (
                          <button
                            onClick={() => acceptOffer(offer.id)}
                            disabled={actingListingId === offer.id}
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            {actingListingId === offer.id ? "Accepting…" : "Accept"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {listing.status === "active" && (
                      <p className="note" style={{ margin: "6px 0 0" }}>
                        Accepting an offer marks the ad sold and emails that buyer your contact info.
                      </p>
                    )}
                  </div>
                )}
                {listing.offers.length === 0 && listing.status === "active" && (
                  <p className="note">No offers yet.</p>
                )}

                <div className="btn-row">
                  <button onClick={() => startEdit(listing)} disabled={listing.status !== "active"}>
                    Edit
                  </button>
                  {listing.status !== "removed" && (
                    <button
                      className="secondary"
                      onClick={() => setArchiveConfirmListing(listing)}
                      disabled={listing.status === "archived" || actingListingId === listing.id}
                    >
                      {listing.status === "archived" ? "Archived" : "Delete (archive 30 days)"}
                    </button>
                  )}
                  {listing.status === "active" && (
                    <button onClick={() => setPromoteListing(listing)}>
                      {activePremium(listing) ? "Renew / upgrade" : "Promote (Top / VIP)"}
                    </button>
                  )}
                  {listing.status !== "archived" && listing.status !== "removed" && (
                    <Link href={`/listing/${listing.id}`}>
                      <button>View</button>
                    </Link>
                  )}
                  {listing.status === "archived" && (
                    <button onClick={() => restoreListing(listing.id)} disabled={!canRestore || actingListingId === listing.id}>
                      Restore
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {promoteListing && (
        <PromoteDialog
          listingId={promoteListing.id}
          title={promoteListing.title}
          onClose={() => setPromoteListing(null)}
          onDone={() => { setPromoteListing(null); load(); }}
        />
      )}

      {archiveConfirmListing && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div className="panel" style={{ maxWidth: 480, margin: 0 }}>
            <h3>Archive this ad?</h3>
            <p>
              <b>{archiveConfirmListing.title}</b> will be hidden immediately, then permanently removed after{" "}
              {ARCHIVE_WINDOW_DAYS} days.
            </p>
            <div className="btn-row">
              <button className="secondary" onClick={() => setArchiveConfirmListing(null)}>
                Cancel
              </button>
              <button onClick={confirmArchiveListing}>Yes, archive ad</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
