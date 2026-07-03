"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send code");
        return;
      }
      setStep("code");
    } catch {
      setError("Network issue while sending code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not log in");
        return;
      }
      router.push("/my-ads");
      router.refresh();
    } catch {
      setError("Network issue while logging in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1>Advertiser login</h1>
      {error && <p className="error">{error}</p>}
      {step === "email" && (
        <div className="panel">
          <div className="field">
            <label>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <button disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send login code"}</button>
        </div>
      )}
      {step === "code" && (
        <div className="panel">
          <div className="field">
            <label>Enter your 6-digit login code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          </div>
          <button disabled={busy} onClick={login}>{busy ? "Logging in…" : "Log in"}</button>
        </div>
      )}
    </div>
  );
}
