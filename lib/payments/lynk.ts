// Lynk does not (as of writing) offer a public self-serve REST API the way
// PayPal does. Access is granted after applying for a LynkBiz / Lynk merchant
// account — sign up at https://www.lynk.us/lynkbiz-jamdex-form or email
// sales@lynk.us, and their team issues API credentials + integration docs
// directly to approved merchants.
//
// IMPORTANT: there appear to be two distinct "Lynk" wallets referenced in the
// Jamaican market (one tied to NCB, one a JN Group/Digicel joint venture) —
// confirm with whoever approves your merchant account which one issues your
// credentials, since their docs/endpoints will differ.
//
// Until you have real credentials, this adapter throws so it's obvious in
// development that Lynk isn't wired up yet. Two integration paths Lynk
// commonly supports once you're approved:
//   1. Payment link / QR code — generate a link or static QR in the LynkBiz
//      portal, no API call needed, just display it during checkout.
//   2. API-based order creation + webhook confirmation — once you have
//      docs, implement createLynkOrder() below the same way paypal.ts
//      implements createPaypalOrder(), and verify webhook signatures the
//      same way you'd verify PayPal webhooks.

export async function createLynkOrder(_amountJmd: number, _description: string) {
  throw new Error(
    "Lynk API not yet configured. Apply for a LynkBiz merchant account, then " +
      "implement this function using the credentials/docs Lynk provides."
  );
}

export async function verifyLynkPayment(_reference: string) {
  throw new Error("Lynk API not yet configured.");
}
