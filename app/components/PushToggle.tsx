"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied";

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_PUBLIC_KEY;
    if (!supported) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setError("");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) { setError("Could not save your subscription. Please try again."); return; }
      setState("on");
    } catch {
      setError("Could not enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError("");
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="note-light" style={{ margin: 0 }}>Checking…</p>;
  if (state === "unsupported") {
    return <p className="note" style={{ margin: 0 }}>Push notifications aren&apos;t supported in this browser. On iPhone, add 2ndLife to your Home Screen first.</p>;
  }
  if (state === "denied") {
    return <p className="note" style={{ margin: 0 }}>Notifications are blocked. Enable them for this site in your browser settings, then reload.</p>;
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {state === "on" ? (
        <>
          <p className="note" style={{ marginTop: 0 }}>✅ Push notifications are on for this device.</p>
          <button className="secondary" disabled={busy} onClick={disable}>{busy ? "Working…" : "Turn off notifications"}</button>
        </>
      ) : (
        <>
          <p className="note" style={{ marginTop: 0 }}>Get alerted about offers, your ad status, and (for staff) reviews and refunds — even when the app is closed.</p>
          <button disabled={busy} onClick={enable}>{busy ? "Working…" : "Turn on notifications"}</button>
        </>
      )}
    </div>
  );
}
