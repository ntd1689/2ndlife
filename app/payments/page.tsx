"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaymentRow = {
  id: string;
  type: "unlimited_listing" | "featured" | "relist" | "top_ad" | "vip_ad";
  provider: string;
  amountJmd: number;
  status: "pending" | "completed" | "failed" | "refund_requested" | "refunded";
  createdAt: string;
  completedAt: string | null;
  refundRequestedAt: string | null;
  refundedAt: string | null;
  listing: { id: string; title: string } | null;
  refundEligible: boolean;
};

const TYPE_LABELS: Record<PaymentRow["type"], string> = {
  unlimited_listing: "Unlimited duration",
  featured: "Featured placement",
  relist: "Relist ad",
  top_ad: "Top promotion",
  vip_ad: "VIP promotion",
};

const STATUS_LABELS: Record<PaymentRow["status"], string> = {
  pending: "Pending",
  completed: "Paid",
  failed: "Failed",
  refund_requested: "Refund requested",
  refunded: "Refunded",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [windowDays, setWindowDays] = useState<number>(0);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/me/payments");
      if (res.status === 401) {
        setNeedsLogin(true);
        setPayments([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load your payments");
        setPayments([]);
        return;
      }
      setPayments(data.payments);
      setWindowDays(data.refundWindowDays);
    } catch {
      setError("Network issue while loading your payments.");
      setPayments([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRefundRequest(id: string) {
    setError("");
    if (reason.trim().length < 5) {
      setError("Tell us briefly why you want a refund (at least 5 characters)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${id}/refund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit your refund request");
        return;
      }
      setRequestingId(null);
      setReason("");
      load();
    } catch {
      setError("Network issue while submitting. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <h1>My payments</h1>
      {error && <p className="error">{error}</p>}

      {needsLogin ? (
        <p className="note-light" style={{ marginTop: 10 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to see your payments.
        </p>
      ) : payments === null ? (
        <p className="note-light">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="note-light" style={{ marginTop: 10 }}>
          No payments yet — upgrades and promotions you buy will show up here.
        </p>
      ) : (
        <>
          {windowDays > 0 && (
            <p className="note-light" style={{ marginTop: 6 }}>
              Refunds can be requested within {windowDays} day{windowDays === 1 ? "" : "s"} of payment.
            </p>
          )}
          {payments.map((p) => (
            <div key={p.id} className="panel" style={{ maxWidth: "none", marginTop: 14 }}>
              <div className="payment-row">
                <div>
                  <b>{TYPE_LABELS[p.type]}</b>
                  {p.listing && (
                    <>
                      {" — "}
                      <Link href={`/listing/${p.listing.id}`} style={{ textDecoration: "underline" }}>
                        {p.listing.title}
                      </Link>
                    </>
                  )}
                  <p className="note" style={{ margin: "4px 0 0" }}>
                    {new Date(p.completedAt ?? p.createdAt).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}{" "}
                    · {p.provider === "paypal" ? "PayPal" : p.provider}
                  </p>
                </div>
                <div className="payment-side">
                  <span className="mono payment-amount">J${p.amountJmd.toLocaleString()}</span>
                  <span className={`tag pay-status pay-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                </div>
              </div>

              {p.status === "refund_requested" && (
                <p className="note" style={{ marginTop: 8 }}>
                  Refund requested {p.refundRequestedAt ? new Date(p.refundRequestedAt).toLocaleDateString() : ""} — our
                  team is reviewing it.
                </p>
              )}
              {p.status === "refunded" && (
                <p className="note" style={{ marginTop: 8 }}>
                  Refunded {p.refundedAt ? new Date(p.refundedAt).toLocaleDateString() : ""} to your original payment
                  method.
                </p>
              )}

              {p.refundEligible && requestingId !== p.id && (
                <div className="btn-row">
                  <button className="secondary" onClick={() => { setRequestingId(p.id); setReason(""); setError(""); }}>
                    Request refund
                  </button>
                </div>
              )}
              {requestingId === p.id && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label>Why do you want a refund?</label>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
                  <div className="btn-row">
                    <button disabled={busy} onClick={() => submitRefundRequest(p.id)}>
                      {busy ? "Submitting…" : "Submit request"}
                    </button>
                    <button className="ghost" disabled={busy} onClick={() => setRequestingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
