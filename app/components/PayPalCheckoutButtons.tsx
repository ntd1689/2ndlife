"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

let sdkLoadingPromise: Promise<void> | null = null;

function loadPaypalSdk(clientId: string): Promise<void> {
  if (window.paypal) return Promise.resolve();
  if (sdkLoadingPromise) return sdkLoadingPromise;

  sdkLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.body.appendChild(script);
  });
  return sdkLoadingPromise;
}

export default function PayPalCheckoutButtons({
  createOrder,
  onApproved,
  onError,
}: {
  createOrder: () => Promise<string>; // returns a PayPal orderId from our server
  onApproved: (orderId: string) => Promise<void>; // calls our /capture endpoint
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      onError("PayPal isn't configured yet (missing NEXT_PUBLIC_PAYPAL_CLIENT_ID).");
      return;
    }

    let cancelled = false;

    loadPaypalSdk(clientId)
      .then(() => {
        if (cancelled || !containerRef.current || !window.paypal) return;
        containerRef.current.innerHTML = "";
        window.paypal
          .Buttons({
            style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
            createOrder: async () => {
              try {
                return await createOrder();
              } catch (e: any) {
                onError(e.message || "Could not start checkout");
                throw e;
              }
            },
            onApprove: async (data: { orderID: string }) => {
              try {
                await onApproved(data.orderID);
              } catch (e: any) {
                onError(e.message || "Payment did not complete");
              }
            },
            onError: (err: any) => {
              onError(typeof err === "string" ? err : "PayPal checkout error");
            },
          })
          .render(containerRef.current);
      })
      .catch((e) => onError(e.message));

    return () => { cancelled = true; };
  }, []);

  return <div ref={containerRef} />;
}
