"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "../components/GoogleSignInButton";
import Turnstile, { Honeypot, turnstileEnabledClient } from "../components/Turnstile";

type Step = "email" | "code";

const REMEMBER_KEY = "2ndlife_remember_email";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [remember, setRemember] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    // Surface errors from a failed Google OAuth redirect.
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);

    // Pre-fill a remembered email from a previous login on this device.
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setEmail(saved); setRemember(true); }
    } catch { /* localStorage unavailable */ }

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.googleSignInEnabled))
      .catch(() => {});
  }, []);

  // Tick down the resend cooldown (matches the server's 60s per-email cooldown).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function requestCode(isResend: boolean) {
    setError("");
    setResendMsg("");
    if (!email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (turnstileEnabledClient && !turnstileToken) {
      setError("Please complete the verification below.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken, honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send code");
        return;
      }

      // Remember (or forget) the email for next time.
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* ignore */ }

      setStep("code");
      setResendCooldown(60);
      // A Turnstile token is single-use; drop the spent one and force a fresh
      // widget so the next request (e.g. a resend) gets a new token.
      setTurnstileToken("");
      setTurnstileKey((k) => k + 1);
      if (isResend) setResendMsg("A new code is on its way to your email.");
    } catch {
      setError("Network issue while sending code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setError("");
    setResendMsg("");
    setResendCooldown(0);
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
      <h1>Log in</h1>
      {error && <p className="error">{error}</p>}
      {step === "email" && (
        <div className="panel">
          {googleEnabled && (
            <>
              <GoogleSignInButton next="/my-ads" />
              <div className="auth-divider">or continue with email</div>
            </>
          )}
          <div className="field">
            <label>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              id="remember-email"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: "auto" }}
            />
            <label htmlFor="remember-email" style={{ margin: 0 }}>Remember my email on this device</label>
          </div>
          <Honeypot value={honeypot} onChange={setHoneypot} />
          <Turnstile key={turnstileKey} onToken={setTurnstileToken} />
          <button disabled={busy} onClick={() => requestCode(false)}>{busy ? "Sending…" : "Send login code"}</button>
          <p className="note" style={{ marginTop: 12 }}>
            New to 2ndLife? <Link href="/signup" style={{ textDecoration: "underline" }}>Create an account</Link>
          </p>
        </div>
      )}
      {step === "code" && (
        <div className="panel">
          <p className="note" style={{ marginTop: 0 }}>
            We sent a 6-digit code to <b>{email}</b>.
          </p>
          <div className="field">
            <label>Enter your 6-digit login code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
          </div>
          {resendMsg && <p className="note" style={{ color: "var(--teal-light)" }}>{resendMsg}</p>}
          <button disabled={busy} onClick={login}>{busy ? "Logging in…" : "Log in"}</button>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="secondary"
              disabled={busy || resendCooldown > 0}
              onClick={() => requestCode(true)}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={changeEmail}>
              ← Change email
            </button>
          </div>
          {/* Kept mounted on this step so a resend has a fresh Turnstile token. */}
          <Honeypot value={honeypot} onChange={setHoneypot} />
          <Turnstile key={turnstileKey} onToken={setTurnstileToken} />
        </div>
      )}
    </div>
  );
}
