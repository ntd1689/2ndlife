"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PushToggle from "../components/PushToggle";

type Me = {
  email: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  createdAt: string;
};

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (data.user) {
          setMe(data.user);
          setName(data.user.name ?? "");
          setPhone(data.user.phone ?? "");
        }
      } catch {
        setError("Could not load your account. Please refresh.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function save() {
    setError("");
    setSaved(false);

    const body: { name?: string; phone?: string } = {};
    if (name.trim() && name.trim() !== (me?.name ?? "")) body.name = name.trim();
    if (phone.trim() && phone.trim() !== (me?.phone ?? "")) body.phone = phone.trim();
    if (Object.keys(body).length === 0) {
      setError("Nothing to save yet — change your name or phone first.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save your profile");
        return;
      }
      setMe((prev) => (prev ? { ...prev, ...data.user } : prev));
      setSaved(true);
    } catch {
      setError("Network issue while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="wrap" style={{ maxWidth: 640 }}>
        <p className="note-light">Loading…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="wrap" style={{ maxWidth: 640 }}>
        <h1>Account settings</h1>
        <p className="note-light">
          <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link> to manage your account.
        </p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1>Account settings</h1>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <div className="profile-identity">
          {me.image ? (
            <img src={me.image} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">
              {(me.name || me.email)[0].toUpperCase()}
            </span>
          )}
          <div>
            <p className="profile-email">{me.email}</p>
            <p className="note" style={{ margin: 0 }}>
              Member since {new Date(me.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })}.
              Your email is verified and can't be changed here.
            </p>
          </div>
        </div>

        <div className="field">
          <label>Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marcia B." />
        </div>
        <div className="field">
          <label>Phone number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 876 555 0100" />
          <p className="note" style={{ margin: 0 }}>
            Shared with buyers so they can reach you — make sure it's correct.
          </p>
        </div>

        <button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
        {saved && !error && <p className="note" style={{ marginTop: 8 }}>Saved ✓</p>}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Push notifications</h3>
        <PushToggle />
      </div>
    </div>
  );
}
