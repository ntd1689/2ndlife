"use client";

import { useEffect, useState } from "react";

type Me = { user: { id: string; email: string } | null; isAdmin: boolean };

type AdminListing = {
  id: string;
  title: string;
  status: string;
  askingPrice: number | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string };
  media: { url: string }[];
  openReportCount: number;
  category: { name: string };
  sortOrder: number;
  premiumTier: "none" | "top" | "vip";
  premiumUntil: string | null;
  uniqueViews: number;
};

type Settings = {
  freeAdDays: number;
  topAdPriceJmd: number;
  topAdDays: number;
  vipAdPriceJmd: number;
  vipAdDays: number;
  refundWindowDays: number;
};

type RefundRequest = {
  id: string;
  type: string;
  amountJmd: number;
  refundReason: string | null;
  refundRequestedAt: string | null;
  completedAt: string | null;
  user: { email: string; name: string | null };
  listing: { id: string; title: string } | null;
};

function tierLabel(l: AdminListing): string {
  if (l.premiumTier === "none" || !l.premiumUntil) return "";
  const until = new Date(l.premiumUntil);
  if (until.getTime() < Date.now()) return ` · ${l.premiumTier.toUpperCase()} (expired)`;
  return ` · ${l.premiumTier === "vip" ? "★ VIP" : "TOP"} until ${until.toLocaleDateString()}`;
}

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

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("position");

  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  const [sortDrafts, setSortDrafts] = useState<Record<string, string>>({});
  const [promoDayDrafts, setPromoDayDrafts] = useState<Record<string, string>>({});

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

  async function loadListings(sortOverride?: string) {
    setListingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      if (reportedOnly) params.set("reported", "true");
      params.set("sort", sortOverride ?? sortBy);
      const res = await fetch(`/api/admin/listings?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setListings(data.listings);
        setSortDrafts(Object.fromEntries(data.listings.map((l: AdminListing) => [l.id, String(l.sortOrder)])));
      }
    } finally {
      setListingsLoading(false);
    }
  }

  useEffect(() => {
    if (me?.isAdmin) {
      loadReports();
      loadListings();
      loadSettings();
      loadRefunds();
    }
  }, [me?.isAdmin]);

  async function loadRefunds() {
    setRefundsLoading(true);
    try {
      const res = await fetch("/api/admin/refunds");
      const data = await res.json();
      if (res.ok) setRefunds(data.requests);
    } finally {
      setRefundsLoading(false);
    }
  }

  async function resolveRefund(id: string, action: "approve" | "deny") {
    if (action === "approve" && !confirm("Approve this refund? The money is returned via PayPal and the purchased upgrade is removed.")) return;
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setActionError(data.error || "Could not resolve refund request"); return; }
      await Promise.all([loadRefunds(), loadListings()]);
    } finally {
      setActingId(null);
    }
  }

  async function loadSettings() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    if (res.ok) setSettings(data.settings);
  }

  async function saveSettings() {
    if (!settings) return;
    setSettingsMsg("");
    setSettingsBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) { setSettingsMsg(data.error || "Could not save settings"); return; }
      setSettings(data.settings);
      setSettingsMsg("Saved ✓");
    } finally {
      setSettingsBusy(false);
    }
  }

  function setSetting(key: keyof Settings, value: string) {
    setSettings((prev) => (prev ? { ...prev, [key]: Number(value) || 0 } : prev));
  }

  async function saveSortOrder(id: string) {
    const draft = sortDrafts[id];
    const value = Number(draft);
    if (!draft || !Number.isInteger(value) || value < 1) {
      setActionError("Position weight must be a whole number of 1 or more");
      return;
    }
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: value }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not update position"); return; }
      await loadListings();
    } finally {
      setActingId(null);
    }
  }

  async function promote(id: string, tier: "none" | "top" | "vip") {
    const daysDraft = promoDayDrafts[id];
    const days = daysDraft ? Number(daysDraft) : undefined;
    if (daysDraft && (!Number.isInteger(days) || (days as number) < 1)) {
      setActionError("Promotion days must be a whole number of 1 or more");
      return;
    }
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiumTier: tier, ...(tier !== "none" && days ? { premiumDays: days } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not update promotion"); return; }
      await loadListings();
    } finally {
      setActingId(null);
    }
  }

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
      if (!res.ok) { setActionError(data.error || "Could not hide ad"); return; }
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
      if (!res.ok) { setActionError(data.error || "Could not unhide ad"); return; }
      await loadListings();
    } finally {
      setActingId(null);
    }
  }

  async function deleteListing(id: string) {
    if (!confirm("Permanently delete this ad and its media? This can't be undone.")) return;
    setActionError("");
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Could not delete ad"); return; }
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

      <h2>Marketplace settings</h2>
      {!settings && <p className="note-light">Loading…</p>}
      {settings && (
        <div className="panel" style={{ maxWidth: "none" }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ width: 140 }}>
              <label>Free ad days</label>
              <input type="number" min={1} value={settings.freeAdDays} onChange={(e) => setSetting("freeAdDays", e.target.value)} />
            </div>
            <div className="field" style={{ width: 150 }}>
              <label>Top Ad price (J$)</label>
              <input type="number" min={0} value={settings.topAdPriceJmd} onChange={(e) => setSetting("topAdPriceJmd", e.target.value)} />
            </div>
            <div className="field" style={{ width: 140 }}>
              <label>Top Ad days</label>
              <input type="number" min={1} value={settings.topAdDays} onChange={(e) => setSetting("topAdDays", e.target.value)} />
            </div>
            <div className="field" style={{ width: 150 }}>
              <label>VIP Ad price (J$)</label>
              <input type="number" min={0} value={settings.vipAdPriceJmd} onChange={(e) => setSetting("vipAdPriceJmd", e.target.value)} />
            </div>
            <div className="field" style={{ width: 140 }}>
              <label>VIP Ad days</label>
              <input type="number" min={1} value={settings.vipAdDays} onChange={(e) => setSetting("vipAdDays", e.target.value)} />
            </div>
            <div className="field" style={{ width: 170 }}>
              <label>Refund window (days)</label>
              <input type="number" min={0} value={settings.refundWindowDays} onChange={(e) => setSetting("refundWindowDays", e.target.value)} />
            </div>
            <button disabled={settingsBusy} onClick={saveSettings}>{settingsBusy ? "Saving…" : "Save settings"}</button>
            {settingsMsg && <span className="note">{settingsMsg}</span>}
          </div>
          <p className="note" style={{ margin: "8px 0 0" }}>
            Position weights: ads with weight 1-10 show as ★ VIP, 11-20 as TOP; anything higher is standard.
            Durations above apply when an ad enters a band; manual promotions can override the number of days per ad.
            Refund window 0 disables refund requests entirely.
          </p>
        </div>
      )}

      <h2 style={{ marginTop: 30 }}>Refund requests</h2>
      {refundsLoading && <p className="note-light">Loading…</p>}
      {!refundsLoading && refunds.length === 0 && <p className="note">No open refund requests.</p>}
      {refunds.map((r) => (
        <div key={r.id} className="panel" style={{ maxWidth: "none" }}>
          <div className="payment-row">
            <div>
              <b>J${r.amountJmd.toLocaleString()}</b> · {r.type.replace(/_/g, " ")}
              {r.listing && (
                <>
                  {" — "}
                  <a href={`/listing/${r.listing.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                    {r.listing.title}
                  </a>
                </>
              )}
              <p className="note" style={{ margin: "4px 0 0" }}>
                {r.user.name ? `${r.user.name} · ` : ""}{r.user.email}
                {" · paid "}{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}
                {" · requested "}{r.refundRequestedAt ? new Date(r.refundRequestedAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
          {r.refundReason && <p style={{ margin: "8px 0 0" }}>“{r.refundReason}”</p>}
          <div className="btn-row">
            <button onClick={() => resolveRefund(r.id, "approve")} disabled={actingId === r.id}>
              {actingId === r.id ? "Working…" : "Approve refund"}
            </button>
            <button className="secondary" onClick={() => resolveRefund(r.id, "deny")} disabled={actingId === r.id}>
              Deny
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 30 }}>Open reports</h2>
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
              <button className="secondary">View ad</button>
            </a>
            <button onClick={() => hideListing(r.listing.id)} disabled={actingId === r.listing.id}>
              Hide ad
            </button>
            <button className="secondary" onClick={() => resolveReport(r.id, "dismissed")} disabled={actingId === r.id}>
              Dismiss report
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 30 }}>All ads</h2>
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
          <div className="field">
            <label>Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); loadListings(e.target.value); }}
            >
              <option value="position">Position weight</option>
              <option value="created_desc">Date created (newest)</option>
              <option value="created_asc">Date created (oldest)</option>
              <option value="updated_desc">Last updated (newest)</option>
              <option value="updated_asc">Last updated (oldest)</option>
            </select>
          </div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} style={{ width: "auto" }} />
            <label style={{ margin: 0 }}>Has open reports</label>
          </div>
          <button onClick={() => loadListings()}>Search</button>
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
              <b>{l.title}</b> · {l.askingPrice != null ? `Asking J$${l.askingPrice.toLocaleString()}` : "Open to offers"}
            </p>
            <p className="note" style={{ margin: "0 0 8px" }}>
              {l.user.email} · {l.category.name} · status: {l.status}{tierLabel(l)} · 👁 {l.uniqueViews} view{l.uniqueViews === 1 ? "" : "s"}
              {l.openReportCount > 0 && <> · {l.openReportCount} open report{l.openReportCount === 1 ? "" : "s"}</>}
              <br />
              created {new Date(l.createdAt).toLocaleDateString()} · updated {new Date(l.updatedAt).toLocaleDateString()}
            </p>
            {l.status === "active" && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
                <div className="field" style={{ width: 120, marginBottom: 0 }}>
                  <label>Position weight</label>
                  <input
                    type="number"
                    min={1}
                    value={sortDrafts[l.id] ?? String(l.sortOrder)}
                    onChange={(e) => setSortDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  />
                </div>
                <button className="secondary" onClick={() => saveSortOrder(l.id)} disabled={actingId === l.id}>
                  Set position
                </button>
                <div className="field" style={{ width: 110, marginBottom: 0 }}>
                  <label>Promo days</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="default"
                    value={promoDayDrafts[l.id] ?? ""}
                    onChange={(e) => setPromoDayDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  />
                </div>
                <button onClick={() => promote(l.id, "vip")} disabled={actingId === l.id}>Make VIP</button>
                <button onClick={() => promote(l.id, "top")} disabled={actingId === l.id}>Make Top</button>
                {l.premiumTier !== "none" && (
                  <button className="secondary" onClick={() => promote(l.id, "none")} disabled={actingId === l.id}>
                    Remove promo
                  </button>
                )}
              </div>
            )}
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
