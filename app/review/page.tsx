"use client";

import { useEffect, useState } from "react";

type QueueAd = {
  id: string;
  title: string;
  description: string;
  reviewStatus: "pending" | "changes_requested";
  flaggedForAdmin: boolean;
  submittedAt: string | null;
  askingPrice: number | null;
  image: string | null;
  owner: { email: string; name: string | null };
  category: string;
  subcategory: string;
  parish: string;
  reviewNote: string | null;
};

type QueueReport = {
  id: string;
  reason: string;
  createdAt: string;
  listing: { id: string; title: string; status: string; reviewStatus: string };
  reporter: { email: string };
};

export default function ReviewPage() {
  const [ads, setAds] = useState<QueueAd[]>([]);
  const [reports, setReports] = useState<QueueReport[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await fetch("/api/review/queue");
      if (res.status === 403) { setAuthorized(false); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not load the review queue"); return; }
      setAds(data.ads);
      setReports(data.reports);
      setIsAdmin(data.isAdmin);
    } catch {
      setError("Network issue while loading the review queue.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(adId: string, action: string) {
    setError("");
    const note = notes[adId]?.trim() || undefined;
    if ((action === "reject" || action === "request_changes") && (!note || note.length < 3)) {
      setError("Add a note (reason / instructions) before you reject or request changes.");
      return;
    }
    setActingId(adId);
    try {
      const res = await fetch(`/api/review/${adId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not complete that action"); return; }
      setNotes((prev) => { const n = { ...prev }; delete n[adId]; return n; });
      load();
    } finally {
      setActingId(null);
    }
  }

  if (!loaded) return <div className="wrap"><p className="note-light">Loading…</p></div>;
  if (!authorized) {
    return (
      <div className="wrap" style={{ maxWidth: 640 }}>
        <h1>Ad review</h1>
        <p className="note-light">This area is for ads reviewers and administrators only.</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      <h1>Ad review</h1>
      {error && <p className="error">{error}</p>}

      <h2>Ads awaiting review ({ads.length})</h2>
      {ads.length === 0 && <p className="note">Nothing in the queue — all caught up. 🎉</p>}
      {ads.map((a) => (
        <div key={a.id} className="panel" style={{ maxWidth: "none", display: "flex", gap: 14 }}>
          {a.image && (
            <img src={a.image} alt="" style={{ width: 110, height: 90, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px" }}>
              <b>{a.title}</b>
              {a.flaggedForAdmin && <span className="tag pay-failed" style={{ marginLeft: 8 }}>FLAGGED</span>}
              {a.reviewStatus === "changes_requested" && <span className="tag pay-refund_requested" style={{ marginLeft: 8 }}>RE-REVIEW</span>}
            </p>
            <p className="note" style={{ margin: "0 0 6px" }}>
              {a.owner.name ? `${a.owner.name} · ` : ""}{a.owner.email} · {a.category} → {a.subcategory} · {a.parish}
              {a.askingPrice != null && <> · Asking J${a.askingPrice.toLocaleString()}</>}
              {a.submittedAt && <> · submitted {new Date(a.submittedAt).toLocaleDateString()}</>}
            </p>
            <p style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>{a.description}</p>

            <textarea
              placeholder="Note to the advertiser (required to reject or request changes)"
              value={notes[a.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
              rows={2}
              style={{ width: "100%" }}
            />
            <div className="btn-row">
              <button onClick={() => act(a.id, "approve")} disabled={actingId === a.id}>Approve</button>
              <button className="secondary" onClick={() => act(a.id, "request_changes")} disabled={actingId === a.id}>Request changes</button>
              <button className="secondary" onClick={() => act(a.id, "reject")} disabled={actingId === a.id}>Reject</button>
              {a.flaggedForAdmin
                ? <button className="ghost" onClick={() => act(a.id, "unflag")} disabled={actingId === a.id}>Unflag</button>
                : <button className="ghost" onClick={() => act(a.id, "flag")} disabled={actingId === a.id}>Flag for admin</button>}
              <a href={`/listing/${a.id}`} target="_blank" rel="noreferrer"><button className="ghost">Preview</button></a>
            </div>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 30 }}>Open reports ({reports.length})</h2>
      {reports.length === 0 && <p className="note">No open reports.</p>}
      {reports.map((r) => (
        <div key={r.id} className="panel" style={{ maxWidth: "none" }}>
          <p style={{ margin: "0 0 4px" }}>
            <b>{r.listing.title}</b> · ad status: {r.listing.status} / {r.listing.reviewStatus}
          </p>
          <p className="note" style={{ margin: "0 0 8px" }}>Reported by {r.reporter.email} on {new Date(r.createdAt).toLocaleDateString()}</p>
          <p style={{ margin: "0 0 10px" }}>{r.reason}</p>
          <a href={`/listing/${r.listing.id}`} target="_blank" rel="noreferrer"><button className="secondary">View ad</button></a>
        </div>
      ))}

      {isAdmin && (
        <p className="note-light" style={{ marginTop: 24 }}>
          You're viewing as an administrator. Report moderation actions (hide/dismiss) live in the <a href="/admin" style={{ textDecoration: "underline" }}>Admin</a> dashboard.
        </p>
      )}
    </div>
  );
}
