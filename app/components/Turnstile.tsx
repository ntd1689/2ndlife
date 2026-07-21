"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY
// is set — otherwise it's a no-op (dev, or before keys are provisioned) and the
// form submits with an empty token, which the server skips. Reports the token
// via onToken; clears it on error/expiry so the parent can require a fresh one.

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const turnstileEnabledClient = !!TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    function render() {
      if (cancelled || !containerRef.current || widgetIdRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    }

    if (window.turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => {
        if (window.turnstile) { clearInterval(poll); render(); }
      }, 200);
      return () => clearInterval(poll);
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* already gone */ }
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} style={{ margin: "12px 0" }} />;
}

// Shared hidden honeypot field: real users never fill it; bots that auto-fill
// every input trip it. Include the `honeypot` value in the request body.
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="company"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
    />
  );
}
