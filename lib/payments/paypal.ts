// Talks to PayPal's REST API directly (v2 orders). No SDK needed — it's a few
// plain HTTP calls. Works in PayPal Sandbox until you flip PAYPAL_ENV to "live".
import { getPaypalWebhookId } from "@/lib/env";

const BASE_URL =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// JMD isn't a PayPal-supported settlement currency, so we charge in USD.
// Set JMD_TO_USD as a simple fixed rate you update periodically, or swap in
// a live FX lookup later.
const JMD_TO_USD_RATE = Number(process.env.JMD_TO_USD_RATE || "0.0064");

export function jmdToUsd(amountJmd: number): string {
  return (amountJmd * JMD_TO_USD_RATE).toFixed(2);
}

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal auth failed: " + (await res.text()));
  const data = await res.json();
  return data.access_token;
}

export async function createPaypalOrder(amountJmd: number, description: string) {
  const token = await getAccessToken();
  const usdAmount = jmdToUsd(amountJmd);

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description,
          amount: { currency_code: "USD", value: usdAmount },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error("PayPal order creation failed: " + (await res.text()));
  const order = await res.json();
  return order; // contains order.id — pass this to the PayPal Buttons on the client
}

export async function capturePaypalOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("PayPal capture failed: " + (await res.text()));
  return res.json();
}

export async function getPaypalOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("PayPal order lookup failed: " + (await res.text()));
  return res.json();
}

// Refund the capture behind a completed order (full refund). We store the
// order id on Payment rows, so look the capture id up from the order first.
export async function refundPaypalOrder(orderId: string) {
  const token = await getAccessToken();
  const order = await getPaypalOrder(orderId);
  const captureId = order?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if (!captureId) throw new Error(`No capture found on PayPal order ${orderId}`);

  const res = await fetch(`${BASE_URL}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}), // empty body = full refund
  });
  if (!res.ok) throw new Error("PayPal refund failed: " + (await res.text()));
  return res.json(); // status: "COMPLETED" (or "PENDING") on success
}

export async function verifyPaypalWebhookSignature(
  headers: Headers,
  rawBody: string,
  event: unknown
): Promise<boolean> {
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: getPaypalWebhookId(),
      webhook_event: event ?? JSON.parse(rawBody),
    }),
  });

  if (!res.ok) {
    return false;
  }

  const payload = await res.json();
  return payload?.verification_status === "SUCCESS";
}
