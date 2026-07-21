"use client";

import { useEffect } from "react";

// Registers the service worker after load so the app is installable and has an
// offline fallback. No-op where service workers aren't supported.
export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failed — app still works, just no offline support */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
