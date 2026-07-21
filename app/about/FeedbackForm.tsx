"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TOPICS = ["Feedback", "Question", "Bug report", "Partnership", "Other"] as const;
type Topic = (typeof TOPICS)[number];

export default function FeedbackForm() {
  // undefined = still loading; null = not logged in; object = logged in
  const [me, setMe] = useState<{ email: string } | null | undefined>(undefined);
  const [topic, setTopic] = useState<Topic>("Feedback");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user ? { email: d.user.email } : null))
      .catch(() => setMe(null));
  }, []);

  async function submit() {
    setError("");
    if (!message.trim()) { setError("Please enter a message."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not send your message."); return; }
      setSent(true);
      setMessage("");
    } catch {
      setError("Could not send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (me === undefined) return <p className="note-light">Loading…</p>;

  if (!me) {
    return (
      <p style={{ margin: 0 }}>
        Questions, feedback, or a partnership idea? We&apos;d love to hear from you.{" "}
        <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to send us a message.
      </p>
    );
  }

  if (sent) {
    return (
      <p style={{ margin: 0 }}>
        Thanks for reaching out — we got your message and will reply to <b>{me.email}</b> if a response is needed.{" "}
        <button className="secondary" onClick={() => setSent(false)} style={{ marginLeft: 6 }}>Send another</button>
      </p>
    );
  }

  return (
    <div>
      <p style={{ marginTop: 0 }}>
        Questions, feedback, or a partnership idea? Send us a message and we&apos;ll reply to <b>{me.email}</b>.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="field" style={{ maxWidth: 260 }}>
        <label>Topic</label>
        <select value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="How can we help?"
        />
      </div>
      <button disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send message"}</button>
    </div>
  );
}
