"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "../components/Pagination";

type PaymentType = "unlimited_listing" | "featured" | "relist" | "top_ad" | "vip_ad";

const TYPE_LABELS: Record<PaymentType, string> = {
  unlimited_listing: "Unlimited duration",
  featured: "Featured placement",
  relist: "Relist ad",
  top_ad: "Top promotion",
  vip_ad: "VIP promotion",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Paid",
  refund_requested: "Refund requested",
  refunded: "Refunded",
};

type Summary = {
  revenueJmd: number;
  paymentCount: number;
  refundedJmd: number;
  refundCount: number;
  byType: { type: PaymentType; count: number; amountJmd: number }[];
  byProvider: { provider: string; count: number; amountJmd: number }[];
};

type TopAdvertiser = {
  userId: string;
  email: string;
  name: string | null;
  paymentCount: number;
  totalJmd: number;
};

type PaymentRow = {
  id: string;
  type: PaymentType;
  provider: string;
  amountJmd: number;
  status: string;
  completedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  listing: { id: string; title: string } | null;
};

type PaymentsResponse = {
  summary: Summary;
  topAdvertisers: TopAdvertiser[];
  payments: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
};

// Presets compute a [from, to] pair (YYYY-MM-DD) relative to today. "all" clears
// the range entirely. "custom" lets the admin pick exact dates.
type Preset = "7d" | "30d" | "mtd" | "ytd" | "all" | "custom";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = ymd(today);
  switch (preset) {
    case "7d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 6);
      return { from: ymd(f), to };
    }
    case "30d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 29);
      return { from: ymd(f), to };
    }
    case "mtd":
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "ytd":
      return { from: ymd(new Date(today.getFullYear(), 0, 1)), to };
    default:
      return { from: "", to: "" };
  }
}

const jmd = (n: number) => `J$${n.toLocaleString()}`;

export default function PaymentsSection() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(rangeForPreset("30d").from);
  const [to, setTo] = useState(rangeForPreset("30d").to);
  const [typeFilter, setTypeFilter] = useState<"" | PaymentType>("");

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(
    async (opts: { page?: number; size?: number } = {}) => {
      const p = opts.page ?? page;
      const size = opts.size ?? pageSize;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (typeFilter) params.set("type", typeFilter);
        params.set("page", String(p));
        params.set("pageSize", String(size));
        const res = await fetch(`/api/admin/payments?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Could not load payments");
          return;
        }
        setData(json);
        setPage(p);
        setPageSize(size);
      } catch {
        setError("Could not load payments");
      } finally {
        setLoading(false);
      }
    },
    [from, to, typeFilter, page, pageSize]
  );

  // Reload whenever the range or type filter changes (reset to page 1).
  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, typeFilter]);

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") {
      const r = rangeForPreset(next);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  const net = data ? data.summary.revenueJmd - data.summary.refundedJmd : 0;

  return (
    <>
      {/* Range + type filters */}
      <div className="panel" style={{ maxWidth: "none" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Period</label>
            <select value={preset} onChange={(e) => applyPreset(e.target.value as Preset)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="mtd">Month to date</option>
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
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | PaymentType)}>
              <option value="">All types</option>
              {(Object.keys(TYPE_LABELS) as PaymentType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="note" style={{ margin: "10px 0 0" }}>
          {from || to ? `Showing ${from || "the beginning"} → ${to || "today"}` : "Showing all payments ever collected"}
          {" · totals count captured payments; refunds are money returned."}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Summary stat cards */}
      <div className="admin-stat-grid" style={{ marginTop: 14 }}>
        <div className="admin-stat static">
          <span className="admin-stat-value money">{data ? jmd(data.summary.revenueJmd) : "—"}</span>
          <span className="admin-stat-label">Revenue collected</span>
        </div>
        <div className="admin-stat static">
          <span className="admin-stat-value">{data ? data.summary.paymentCount.toLocaleString() : "—"}</span>
          <span className="admin-stat-label">Payments</span>
        </div>
        <div className="admin-stat static">
          <span className="admin-stat-value money">{data ? jmd(data.summary.refundedJmd) : "—"}</span>
          <span className="admin-stat-label">Refunded ({data?.summary.refundCount ?? 0})</span>
        </div>
        <div className="admin-stat static">
          <span className="admin-stat-value money">{data ? jmd(net) : "—"}</span>
          <span className="admin-stat-label">Net revenue</span>
        </div>
      </div>

      {/* Breakdown by type / provider */}
      {data && (data.summary.byType.length > 0 || data.summary.byProvider.length > 0) && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
          {data.summary.byType.length > 0 && (
            <div className="panel" style={{ maxWidth: "none", flex: 1, minWidth: 260 }}>
              <h3 style={{ marginTop: 0 }}>By purchase type</h3>
              <table className="admin-table">
                <tbody>
                  {data.summary.byType.map((b) => (
                    <tr key={b.type}>
                      <td>{TYPE_LABELS[b.type]}</td>
                      <td className="note" style={{ textAlign: "right" }}>{b.count}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{jmd(b.amountJmd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.summary.byProvider.length > 0 && (
            <div className="panel" style={{ maxWidth: "none", flex: 1, minWidth: 260 }}>
              <h3 style={{ marginTop: 0 }}>By provider</h3>
              <table className="admin-table">
                <tbody>
                  {data.summary.byProvider.map((b) => (
                    <tr key={b.provider}>
                      <td style={{ textTransform: "capitalize" }}>{b.provider}</td>
                      <td className="note" style={{ textAlign: "right" }}>{b.count}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{jmd(b.amountJmd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top advertisers */}
      <div className="panel" style={{ maxWidth: "none", marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Top-value advertisers</h3>
        {data && data.topAdvertisers.length === 0 && <p className="note">No payments in this period.</p>}
        {data && data.topAdvertisers.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Advertiser</th>
                <th style={{ textAlign: "right" }}>Payments</th>
                <th style={{ textAlign: "right" }}>Total paid</th>
              </tr>
            </thead>
            <tbody>
              {data.topAdvertisers.map((a, i) => (
                <tr key={a.userId}>
                  <td className="note">{i + 1}</td>
                  <td>
                    <b>{a.name || a.email}</b>
                    {a.name && <div className="note">{a.email}</div>}
                  </td>
                  <td className="note" style={{ textAlign: "right" }}>{a.paymentCount}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{jmd(a.totalJmd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ledger */}
      <h3 style={{ marginTop: 22 }}>All payments</h3>
      {loading && <p className="note-light">Loading…</p>}
      {!loading && data && data.payments.length === 0 && <p className="note">No payments in this period.</p>}
      {data && data.payments.length > 0 && (
        <>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            label="payments"
            onPageChange={(p) => load({ page: p })}
            onPageSizeChange={(s) => load({ page: 1, size: s })}
          />
          <div className="panel" style={{ maxWidth: "none", overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Advertiser</th>
                  <th>Type</th>
                  <th>Provider</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="note" style={{ whiteSpace: "nowrap" }}>
                      {p.completedAt ? new Date(p.completedAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      {p.user.name || p.user.email}
                      {p.listing && (
                        <div className="note">
                          <a href={`/listing/${p.listing.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                            {p.listing.title}
                          </a>
                        </div>
                      )}
                    </td>
                    <td>{TYPE_LABELS[p.type]}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.provider}</td>
                    <td className="mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{jmd(p.amountJmd)}</td>
                    <td>
                      <span className={`tag pay-status pay-${p.status}`}>{STATUS_LABELS[p.status] ?? p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            label="payments"
            onPageChange={(p) => load({ page: p })}
            onPageSizeChange={(s) => load({ page: 1, size: s })}
          />
        </>
      )}
    </>
  );
}
