"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "../components/GoogleSignInButton";
import Turnstile, { Honeypot } from "../components/Turnstile";
import { useOtpEmail } from "../components/useOtpEmail";

type Step = "email" | "code" | "phone";

export default function SignupPage() {
  const router = useRouter();
  const otp = useOtpEmail();
  const [step, setStep] = useState<Step>("email");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [signupsClosed, setSignupsClosed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { setGoogleEnabled(!!d.googleSignInEnabled); setSignupsClosed(d.signupsEnabled === false); })
      .catch(() => {});
  }, []);

  async function requestCode(isResend: boolean) {
    setError("");
    setBusy(true);
    const err = await otp.sendOtp(isResend);
    setBusy(false);
    if (err) { setError(err); return; }
    setStep("code");
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setError("");
    otp.resetForEmailChange();
  }

  async function verify() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otp.email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }
      // Account created + signed in. Save the display name if provided.
      if (name.trim()) {
        await fetch("/api/me/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        }).catch(() => {});
      }
      setStep("phone");
    } catch {
      setError("Network issue while verifying code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(skip = false) {
    setError("");
    if (!skip) {
      if (!phone.trim()) {
        setError("Enter a phone number, or skip for now");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/me/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not save phone number");
          return;
        }
      } catch {
        setError("Network issue while saving phone number. Please try again.");
        return;
      } finally {
        setBusy(false);
      }
    }
    router.push("/my-ads");
    router.refresh();
  }

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1>Create your account</h1>
      {error && <p className="error">{error}</p>}

      {signupsClosed && step === "email" && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            New sign-ups are temporarily closed — please check back soon.
          </p>
          <p className="note" style={{ marginTop: 8 }}>
            Already have an account? <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link>
          </p>
        </div>
      )}

      {!signupsClosed && step === "email" && (
        <div className="panel">
          {googleEnabled && (
            <>
              <GoogleSignInButton next="/my-ads" />
              <div className="auth-divider">or sign up with email</div>
            </>
          )}
          <div className="demo-note">
            We'll email you a one-time code to verify your account — no phone or SMS needed to sign up.
          </div>
          <div className="field">
            <label>Your name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marcia B." />
          </div>
          <div className="field">
            <label>Email address</label>
            <input value={otp.email} onChange={(e) => otp.setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              id="remember-email"
              type="checkbox"
              checked={otp.remember}
              onChange={(e) => otp.setRemember(e.target.checked)}
              style={{ width: "auto" }}
            />
            <label htmlFor="remember-email" style={{ margin: 0 }}>Remember my email on this device</label>
          </div>
          <Honeypot value={otp.honeypot} onChange={otp.setHoneypot} />
          <Turnstile key={otp.turnstileKey} onToken={otp.setTurnstileToken} />
          <button disabled={busy} onClick={() => requestCode(false)}>{busy ? "Sending…" : "Send verification code"}</button>
          <p className="note" style={{ marginTop: 12 }}>
            Already have an account? <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link>
          </p>
        </div>
      )}

      {step === "code" && (
        <div className="panel">
          <p className="note" style={{ marginTop: 0 }}>
            We sent a 6-digit code to <b>{otp.email}</b>.
          </p>
          <div className="field">
            <label>Enter the 6-digit code we emailed you</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
          </div>
          {otp.resendMsg && <p className="note" style={{ color: "var(--teal-light)" }}>{otp.resendMsg}</p>}
          <button disabled={busy} onClick={verify}>{busy ? "Verifying…" : "Verify & continue"}</button>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="secondary" disabled={busy || otp.resendCooldown > 0} onClick={() => requestCode(true)}>
              {otp.resendCooldown > 0 ? `Resend code in ${otp.resendCooldown}s` : "Resend code"}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={changeEmail}>
              ← Change email
            </button>
          </div>
          {/* Kept mounted so a resend has a fresh Turnstile token. */}
          <Honeypot value={otp.honeypot} onChange={otp.setHoneypot} />
          <Turnstile key={otp.turnstileKey} onToken={otp.setTurnstileToken} />
        </div>
      )}

      {step === "phone" && (
        <div className="panel">
          <div className="demo-note">
            Buyers will see this number to contact you directly. We don't verify it by SMS — just make sure it's correct.
          </div>
          <div className="field">
            <label>Phone number (optional, recommended)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 876 555 0100" />
          </div>
          <div className="btn-row">
            <button disabled={busy} onClick={() => finish(false)}>{busy ? "Saving…" : "Save & finish"}</button>
            <button className="secondary" disabled={busy} onClick={() => finish(true)}>Skip for now</button>
          </div>
        </div>
      )}
    </div>
  );
}
