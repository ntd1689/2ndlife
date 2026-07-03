"use client";

import { useEffect, useState } from "react";

type Me = { user: { id: string; email: string } | null; isAdmin: boolean };

type AdminListing = {
  id: string;
  title: string;
  status: string;
  buyNowPrice: number;
  createdAt: string;
  user: { email: string };
  media: { url: string }[];
  openReportCount: number;
};

type Report = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  listing: { id: string; title: string; status: string };
  reporter: { email: string };
};

const LISTING_STATUSES = ["active", "expired", "archived", "sold", "removed", "deleted"];

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loginStep, setLoginStep] = useState<"email" | "code">("email");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);

  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  async function loadMe() {
    setMeLoading(true);
    try {
      const res = await fetch("/api/me");
      setMe(await res.json());
    } finally {
      setMeLoading(false);
    }
  }

  useEffect(() => { loadMe(); }, []);

  async function loadReports() {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/admin/reports?status=open");
      const data = await res.json();
      if (res.ok) setReports(data.reports);
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadListings() {
    setListingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      if (reportedOnly) params.set("reported", "true");
      const res = await fetch(`/api/admin/listings?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setListings(data.listings);
    } finally {
      setListingsLoading(false);
    }
  }

  useEffect(() => {
    if (me?.isAdmin) {
      loadReports();
      loadListings();
    }
  }, [me?.isAdmin]);

  async function sendCode() {
    setLoginError("");
    if (!email.includes("@")) { setLoginError("Enter a valid email address"); return; }
    setLoginBusy(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { setLoginError("Could not send code"); return; }
      setLoginStep("code");
    } finally {
      setLoginBusy(false);
    }
  }

  async function verifyCode() {
    setLoginError("");
    setLoginBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Invalid code"); return; }
      await loadMe();
    } finally {
      setLoginBusy(false);
    }
  }

  async function hideListing(id: string) {
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}/hide`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not hide listing"); return; }
      await Promise.all([loadListings(), loadReports()]);
    } finally {
      setActingId(null);
    }
  }

  async function unhideListing(id: string) {
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}/unhide`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not unhide listing"); return; }
      await loadListings();
    } finally {
      setActingId(null);
    }
  }

  async function deleteListing(id: string) {
    if (!confirm("Permanently delete this listing and its media? This can't be undone.")) return;
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not delete listing"); return; }
      await loadListings();
    } finally {
      setActingId(null);
    }
  }

  async function resolveReport(id: string, status: "resolved" | "dismissed") {
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not update report"); return; }
      await loadReports();
    } finally {
      setActingId(null);
    }
  }

  if (meLoading) return <div className="wrap">Loading…</div>;

  if (!me?.user) {
    return (
      <div className="wrap" style={{ maxWidth: 480 }}>
        <h1>Admin login</h1>
        {loginError && <p className="error">{loginError}</p>}
        {loginStep === "email" ? (
          <div className="panel">
            <div className="field">
              <label>Email address</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <button disabled={loginBusy} onClick={sendCode}>{loginBusy ? "Sending…" : "Send code"}</button>
          </div>
        ) : (
          <div className="panel">
            <div className="field">
              <label>Enter the 6-digit code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            </div>
            <button disabled={loginBusy} onClick={verifyCode}>{loginBusy ? "Verifying…" : "Log in"}</button>
          </div>
        )}
      </div>
    );
  }

  if (!me.isAdmin) {
    return (
      <div className="wrap">
        <h1>Admin</h1>
        <p className="error">{me.user.email} doesn't have admin access.</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      <h1>Admin</h1>
      {actionError && <p className="error">{actionError}</p>}

      <h2>Open reports</h2>
      {reportsLoading && <p className="note-light">Loading…</p>}
      {!reportsLoading && reports.length === 0 && <p className="note">No open reports.</p>}
      {reports.map((r) => (
        <div key={r.id} className="panel" style={{ maxWidth: "none" }}>
          <p style={{ margin: "0 0 4px" }}>
            <b>{r.listing.title}</b> · listing status: {r.listing.status}
          </p>
          <p className="note" style={{ margin: "0 0 8px" }}>
            Reported by {r.reporter.email} on {new Date(r.createdAt).toLocaleDateString()}
          </p>
          <p style={{ margin: "0 0 10px" }}>{r.reason}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={`/listing/${r.listing.id}`} target="_blank" rel="noreferrer">
              <button className="secondary">View listing</button>
            </a>
            <button onClick={() => hideListing(r.listing.id)} disabled={actingId === r.listing.id}>
              Hide listing
            </button>
            <button className="secondary" onClick={() => resolveReport(r.id, "dismissed")} disabled={actingId === r.id}>
              Dismiss report
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 30 }}>All listings</h2>
      <div className="panel" style={{ maxWidth: "none" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Search title</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadListings()} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Any</option>
              {LISTING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} style={{ width: "auto" }} />
            <label style={{ margin: 0 }}>Has open reports</label>
          </div>
          <button onClick={loadListings}>Search</button>
        </div>
      </div>

      {listingsLoading && <p className="note-light">Loading…</p>}
      {!listingsLoading && listings.length === 0 && <p className="note">No listings match.</p>}
      {listings.map((l) => (
        <div key={l.id} className="panel" style={{ maxWidth: "none", display: "flex", gap: 14 }}>
          {l.media[0] && (
            <img src={l.media[0].url} alt="" style={{ width: 100, height: 80, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px" }}>
              <b>{l.title}</b> · J${l.buyNowPrice.toLocaleString()}
            </p>
            <p className="note" style={{ margin: "0 0 8px" }}>
              {l.user.email} · status: {l.status}
              {l.openReportCount > 0 && <> · {l.openReportCount} open report{l.openReportCount === 1 ? "" : "s"}</>}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {l.status !== "removed" && l.status !== "deleted" && l.status !== "archived" && (
                <a href={`/listing/${l.id}`} target="_blank" rel="noreferrer">
                  <button className="secondary">View</button>
                </a>
              )}
              {l.status !== "removed" && l.status !== "deleted" && (
                <button onClick={() => hideListing(l.id)} disabled={actingId === l.id}>Hide</button>
              )}
              {l.status === "removed" && (
                <button onClick={() => unhideListing(l.id)} disabled={actingId === l.id}>Unhide</button>
              )}
              {l.status !== "deleted" && (
                <button className="secondary" onClick={() => deleteListing(l.id)} disabled={actingId === l.id}>
                  Delete permanently
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
