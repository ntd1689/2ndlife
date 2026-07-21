"use client";

import { useCallback, useEffect, useState } from "react";
import { turnstileEnabledClient } from "./Turnstile";

// Shared email + OTP-send logic for the login, signup, and post-ad flows:
// "remember my email" persistence, a resend cooldown that mirrors the server's
// 60s per-email limit, and single-use Turnstile token refresh so resends still
// clear the bot challenge. The caller owns `busy`, step transitions, and the
// verify step — this hook only handles requesting the code.

const REMEMBER_KEY = "2ndlife_remember_email";

export function useOtpEmail() {
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");

  // Pre-fill a remembered email from a previous session on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setEmail(saved); setRemember(true); }
    } catch { /* localStorage unavailable */ }
  }, []);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // Requests an OTP for the current email. Returns an error string on failure,
  // or null on success (the caller then advances to its code step).
  const sendOtp = useCallback(
    async (isResend: boolean): Promise<string | null> => {
      setResendMsg("");
      if (!email.includes("@")) return "Enter a valid email address";
      if (turnstileEnabledClient && !turnstileToken) return "Please complete the verification below.";

      try {
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, turnstileToken, honeypot }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return data.error || "Could not send code";

        try {
          if (remember) localStorage.setItem(REMEMBER_KEY, email);
          else localStorage.removeItem(REMEMBER_KEY);
        } catch { /* ignore */ }

        setResendCooldown(60);
        // A Turnstile token is single-use — drop the spent one and remount the
        // widget so the next request gets a fresh token.
        setTurnstileToken("");
        setTurnstileKey((k) => k + 1);
        if (isResend) setResendMsg("A new code is on its way to your email.");
        return null;
      } catch {
        return "Network issue while sending code. Please try again.";
      }
    },
    [email, turnstileToken, honeypot, remember]
  );

  // Clears code-step transient state when the user goes back to edit the email.
  const resetForEmailChange = useCallback(() => {
    setResendMsg("");
    setResendCooldown(0);
  }, []);

  return {
    email, setEmail,
    remember, setRemember,
    turnstileToken, setTurnstileToken, turnstileKey,
    honeypot, setHoneypot,
    resendCooldown, resendMsg,
    sendOtp, resetForEmailChange,
  };
}
