"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "../components/GoogleSignInButton";

type Step = "email" | "code" | "phone";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

  async function verify() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
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
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <button disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send verification code"}</button>
          <p className="note" style={{ marginTop: 12 }}>
            Already have an account? <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link>
          </p>
        </div>
      )}

      {step === "code" && (
        <div className="panel">
          <div className="field">
            <label>Enter the 6-digit code we emailed you</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          </div>
          <button disabled={busy} onClick={verify}>{busy ? "Verifying…" : "Verify & continue"}</button>
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
