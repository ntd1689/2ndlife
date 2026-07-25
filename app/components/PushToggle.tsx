"use client";

import { useEffect, useState } from "react";
import { pushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from "./pushClient";

type State = "loading" | "unsupported" | "off" | "on" | "denied";

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pushSupported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    getPushSubscription().then((sub) => setState(sub ? "on" : "off"));
  }, []);

  async function enable() {
    setError("");
    setBusy(true);
    try {
      const result = await subscribeToPush();
      if (result === "subscribed") setState("on");
      else if (result === "denied") setState("denied");
      else setError("Could not enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError("");
    setBusy(true);
    try {
      await unsubscribeFromPush();
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
