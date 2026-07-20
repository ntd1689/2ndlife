"use client";

import { useCallback, useEffect, useState } from "react";
import { AreaChart, BarList } from "./Charts";

type Kpis = { totalViews: number; revenueJmd: number; orders: number; activeListings: number };
type AmountRow = { name: string; amountJmd: number; count: number };
type ViewRow = { name: string; views: number };
type TopAd = { listingId: string; title: string; views: number; category: string; parish: string; status: string };

type AnalyticsResponse = {
  kpis: Kpis;
  revenueByBucket: { bucket: string; amountJmd: number }[];
  granularity: "day" | "month";
  topAds: TopAd[];
  revenueByCategory: AmountRow[];
  revenueByParish: AmountRow[];
  viewsByCategory: ViewRow[];
  viewsByParish: ViewRow[];
};

type Preset = "7d" | "30d" | "90d" | "ytd" | "all" | "custom";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function rangeForPreset(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = ymd(today);
  const back = (days: number) => {
    const f = new Date(today);
    f.setDate(f.getDate() - days);
    return ymd(f);
  };
  switch (preset) {
    case "7d": return { from: back(6), to };
    case "30d": return { from: back(29), to };
    case "90d": return { from: back(89), to };
    case "ytd": return { from: ymd(new Date(today.getFullYear(), 0, 1)), to };
    default: return { from: "", to: "" };
  }
}

const jmd = (n: number) => `J$${n.toLocaleString()}`;

function formatBucket(bucket: string, granularity: "day" | "month"): string {
  if (granularity === "month") {
    const [y, m] = bucket.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  const d = new Date(`${bucket}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AnalyticsSection() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(rangeForPreset("30d").from);
  const [to, setTo] = useState(rangeForPreset("30d").to);

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not load analytics"); return; }
      setData(json);
    } catch {
      setError("Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") {
      const r = rangeForPreset(next);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  return (
    <>
      {/* Range filter */}
      <div className="panel" style={{ maxWidth: "none" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Period</label>
            <select value={preset} onChange={(e) => applyPreset(e.target.value as Preset)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
              <option value="all">All time</option>
              <option value="custom">Custom range…</option>
            </select>
          </div>
          {preset === "custom" && (
            <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>From</label>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>To</label>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <p className="note" style={{ margin: "10px 0 0" }}>
          {from || to ? `${from || "the beginning"} → ${to || "today"}` : "All activity ever recorded"}
          {" · views count unique visitors; revenue counts captured (non-refunded) payments."}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {/* KPI tiles */}
      <div className="admin-stat-grid" style={{ marginTop: 14 }}>
        <div className="admin-stat static">
          <span className="admin-stat-value">{data ? data.kpis.totalViews.toLocaleString() : "—"}</span>
          <span className="admin-stat-label">Ad views</span>
        </div>
        <div className="admin-stat static">
          <span className="admin-stat-value money">{data ? jmd(data.kpis.revenueJmd) : "—"}</span>
          <span className="admin-stat-label">Ad revenue</span>
        </div>
        <div className="admin-stat static">
          <span className="admin-stat-value">{data ? data.kpis.orders.toLocaleString() : "—"}</span>
          <span className="admin-stat-label">Paid orders</span>
        </div>
        <div className="admin-stat static">
          <span className="admin-stat-value">{data ? data.kpis.activeListings.toLocaleString() : "—"}</span>
          <span className="admin-stat-label">Active ads (now)</span>
        </div>
      </div>

      {loading && !data && <p className="note-light" style={{ marginTop: 14 }}>Loading…</p>}

      {data && (
        <>
          {/* Revenue over time */}
          <div className="panel" style={{ maxWidth: "none", marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Ad revenue over time</h3>
            <p className="note" style={{ margin: "0 0 10px" }}>
              J$ collected per {data.granularity}. Total {jmd(data.kpis.revenueJmd)}.
            </p>
            <AreaChart data={data.revenueByBucket} formatX={(b) => formatBucket(b, data.granularity)} />
          </div>

          {/* Top visited ads */}
          <div className="panel" style={{ maxWidth: "none", marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Top visited ads</h3>
            <BarList
              color="var(--mustard)"
              emptyLabel="No views in this period."
              data={data.topAds.map((a) => ({ label: a.title, sub: `${a.category} · ${a.parish}`, value: a.views }))}
              format={(n) => `${n.toLocaleString()} view${n === 1 ? "" : "s"}`}
            />
          </div>

          {/* Revenue by category / parish */}
          <div className="analytics-cols" style={{ marginTop: 14 }}>
            <div className="panel" style={{ maxWidth: "none" }}>
              <h3 style={{ marginTop: 0 }}>Revenue by category</h3>
              <BarList
                data={data.revenueByCategory.map((c) => ({ label: c.name, sub: `${c.count} order${c.count === 1 ? "" : "s"}`, value: c.amountJmd }))}
                format={jmd}
                emptyLabel="No revenue in this period."
              />
            </div>
            <div className="panel" style={{ maxWidth: "none" }}>
              <h3 style={{ marginTop: 0 }}>Revenue by parish</h3>
              <BarList
                data={data.revenueByParish.map((p) => ({ label: p.name, sub: `${p.count} order${p.count === 1 ? "" : "s"}`, value: p.amountJmd }))}
                format={jmd}
                emptyLabel="No revenue in this period."
              />
            </div>
          </div>

          {/* Views by category / parish */}
          <div className="analytics-cols" style={{ marginTop: 14 }}>
            <div className="panel" style={{ maxWidth: "none" }}>
              <h3 style={{ marginTop: 0 }}>Views by category</h3>
              <BarList
                color="var(--mustard)"
                data={data.viewsByCategory.map((c) => ({ label: c.name, value: c.views }))}
                format={(n) => n.toLocaleString()}
                emptyLabel="No views in this period."
              />
            </div>
            <div className="panel" style={{ maxWidth: "none" }}>
              <h3 style={{ marginTop: 0 }}>Views by parish</h3>
              <BarList
                color="var(--mustard)"
                data={data.viewsByParish.map((p) => ({ label: p.name, value: p.views }))}
                format={(n) => n.toLocaleString()}
                emptyLabel="No views in this period."
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
