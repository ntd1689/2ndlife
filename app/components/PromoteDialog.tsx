"use client";
import { useEffect, useState } from "react";
import PayPalCheckoutButtons from "./PayPalCheckoutButtons";

type Tier = "top" | "vip";

type Settings = {
  topAdPriceJmd: number;
  topAdDays: number;
  vipAdPriceJmd: number;
  vipAdDays: number;
};

// Seller-facing promotion checkout modal: pick Top or VIP, then pay via PayPal.
// On approval it captures the order (which applies the premium tier) and calls
// onDone so the ad list refreshes.
export default function PromoteDialog({
  listingId,
  title,
  onClose,
  onDone,
}: {
  listingId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tier, setTier] = useState<Tier>("vip");
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (!cancelled) setSettings(data);
      } catch {
        if (!cancelled) setError("Could not load promotion prices. Please try again.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function createPromoteOrder(): Promise<string> {
    setError("");
    const res = await fetch(`/api/listings/${listingId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "paypal", tier }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not start checkout");
    return data.orderId;
  }

  async function onApproved(orderId: string) {
    const res = await fetch("/api/payments/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, listingId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Payment did not complete");
    setPaid(true);
  }

  const price = settings && (tier === "vip" ? settings.vipAdPriceJmd : settings.topAdPriceJmd);
  const days = settings && (tier === "vip" ? settings.vipAdDays : settings.topAdDays);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
      <div className="panel" style={{ maxWidth: 480, margin: 0 }} onClick={(e) => e.stopPropagation()}>
        {paid ? (
          <>
            <h3>Promotion active 🎉</h3>
            <p className="note">
              “{title}” is now {tier === "vip" ? "a VIP ad" : "a Top ad"} for {days} days.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onDone}>Done</button>
            </div>
          </>
        ) : (
          <>
            <h3>Promote “{title}”</h3>
            {error && <p className="error">{error}</p>}
            {!settings ? (
              <p className="note">Loading prices…</p>
            ) : (
              <>
                <div
                  className={`plan-option ${tier === "vip" ? "sel" : ""}`}
                  onClick={() => setTier("vip")}
                >
                  <b>★ VIP — J${settings.vipAdPriceJmd.toLocaleString()}</b>
                  <div className="note">
                    Top 10 placement in your category for {settings.vipAdDays} days, with a premium badge.
                  </div>
                </div>
                <div
                  className={`plan-option ${tier === "top" ? "sel" : ""}`}
                  onClick={() => setTier("top")}
                >
                  <b>Top — J${settings.topAdPriceJmd.toLocaleString()}</b>
                  <div className="note">
                    Top 20 placement in your category for {settings.topAdDays} days, with a badge.
                  </div>
                </div>

                <div className="demo-note" style={{ marginTop: 12 }}>
                  Paying J${price?.toLocaleString()} — PayPal settles in USD, converted at checkout.
                </div>
                <PayPalCheckoutButtons
                  createOrder={createPromoteOrder}
                  onApproved={onApproved}
                  onError={(msg) => setError(msg)}
                />
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
