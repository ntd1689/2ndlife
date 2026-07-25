"use client";

import { useEffect, useState } from "react";
import { pushSupported, getPushSubscription, subscribeToPush } from "./pushClient";

// Compact "Turn on notifications" prompt shown at the top of the notification
// bell — only when push is supported, permitted, and not already subscribed.
// Once enabled (or dismissed) it disappears.
export default function BellPushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported() || Notification.permission === "denied") return;
    getPushSubscription().then((sub) => { if (!sub) setShow(true); });
  }, []);

  async function enable() {
    setBusy(true);
    try {
      await subscribeToPush();
    } finally {
      setBusy(false);
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div className="mk-push-prompt">
      <span>🔔 Get alerts even when 2ndLife is closed.</span>
      <div className="mk-push-prompt-actions">
        <button type="button" onClick={enable} disabled={busy}>{busy ? "Enabling…" : "Turn on"}</button>
        <button type="button" className="mk-push-dismiss" onClick={() => setShow(false)} aria-label="Dismiss">Not now</button>
      </div>
    </div>
  );
}
