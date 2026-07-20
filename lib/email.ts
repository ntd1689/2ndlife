import { prisma } from "./prisma";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(email: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Only allow one currently valid OTP per email by consuming older pending
    // codes. Batched in one transaction so both statements share a single
    // round-trip to the database (the create runs after the update, so the new
    // code is not itself consumed).
    await prisma.$transaction([
      prisma.otpCode.updateMany({
        where: { email, consumed: false },
        data: { consumed: true },
      }),
      prisma.otpCode.create({
        data: { email, code, expiresAt },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Database error creating OTP code:", msg);
    throw new Error(`Failed to create OTP code: ${msg}`);
  }

  if (!process.env.RESEND_API_KEY) {
    // Local/dev fallback: no email provider configured, just log it.
    console.log(`[DEV OTP] to ${email}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "2ndLife <onboarding@resend.dev>",
      to: email,
      subject: "Your 2ndLife verification code",
      html: `<p>Your verification code is <b>${code}</b>. It expires in 10 minutes.</p>`,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to send verification email: " + (await res.text()));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.2ndlifejm.net").replace(/\/$/, "");
}

// Shared sender: logs to the console when RESEND_API_KEY is unset (dev), else
// sends via Resend. Never throws to the caller — a failed notification must
// not fail the ad action that triggered it.
async function sendMail(to: string, subject: string, html: string, tag: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV EMAIL] ${tag} -> ${to}: ${subject}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "2ndLife <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) console.error(`Failed to send ${tag} email:`, await res.text());
  } catch (err) {
    console.error(`Failed to send ${tag} email:`, err instanceof Error ? err.message : err);
  }
}

type AdInfo = { id: string; title: string };

// Common footer with ad identity and management links.
function adBlock(ad: AdInfo, note?: string | null): string {
  return `<p><b>Ad:</b> ${escapeHtml(ad.title)}<br><b>Ad ID:</b> ${ad.id}</p>
${note ? `<p><b>Reviewer notes:</b><br>${escapeHtml(note).replace(/\n/g, "<br>")}</p>` : ""}
<p><a href="${siteUrl()}/listing/${ad.id}">View ad</a> · <a href="${siteUrl()}/my-ads">Manage your ads</a></p>`;
}

// Ad submitted or resubmitted -> Pending Review.
export async function sendAdPendingEmail(to: string, ad: AdInfo, resubmitted: boolean) {
  const subject = resubmitted
    ? `Your updated ad "${ad.title}" is back in review`
    : `Your ad "${ad.title}" is awaiting review`;
  const intro = resubmitted
    ? `Thanks — your updated ad has re-entered the review queue.`
    : `Thanks for posting on 2ndLife. Your ad is now <b>pending review</b>.`;
  await sendMail(
    to,
    subject,
    `<p>${intro}</p>
<p>Our team reviews ads for compliance and quality, usually within 24–48 hours. It won't appear publicly until it's approved. <b>Status: Pending review.</b></p>
${adBlock(ad)}`,
    "ad-pending"
  );
}

export async function sendAdApprovedEmail(to: string, ad: AdInfo) {
  await sendMail(
    to,
    `Your ad "${ad.title}" is approved and live`,
    `<p>Good news — your ad has been <b>approved</b> and is now visible on 2ndLife. <b>Status: Approved.</b></p>
${adBlock(ad)}`,
    "ad-approved"
  );
}

export async function sendAdRejectedEmail(to: string, ad: AdInfo, note: string | null) {
  await sendMail(
    to,
    `Your ad "${ad.title}" was not approved`,
    `<p>Your ad was <b>rejected</b> and will not be published. <b>Status: Rejected.</b></p>
<p>You can edit and resubmit it to be reviewed again.</p>
${adBlock(ad, note)}`,
    "ad-rejected"
  );
}

export async function sendAdChangesRequestedEmail(to: string, ad: AdInfo, note: string | null) {
  await sendMail(
    to,
    `Changes requested on your ad "${ad.title}"`,
    `<p>A reviewer has requested <b>changes</b> before your ad can go live. <b>Status: Changes requested.</b></p>
<p>Please update your ad using the notes below and save it — that resubmits it for review.</p>
${adBlock(ad, note)}`,
    "ad-changes"
  );
}

export async function sendOfferAcceptedEmail(
  to: string,
  listingTitle: string,
  amountJmd: number,
  seller: { email: string; phone: string | null }
) {
  const contactLines = [
    `Seller email: ${escapeHtml(seller.email)}`,
    seller.phone ? `Seller phone: ${escapeHtml(seller.phone)}` : null,
  ].filter(Boolean);

  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV EMAIL] offer accepted -> ${to}: "${listingTitle}" at J$${amountJmd}. ${contactLines.join(" / ")}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "2ndLife <onboarding@resend.dev>",
      to,
      subject: `Your offer on "${listingTitle}" was accepted`,
      html: `<p>Good news — the seller accepted your offer of <b>J$${amountJmd.toLocaleString()}</b> for <b>${escapeHtml(listingTitle)}</b>.</p>
<p>${contactLines.join("<br>")}</p>
<p>2ndLife doesn't process the payment itself — arrange payment and pickup directly with the seller.</p>`,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to send offer-accepted email: " + (await res.text()));
  }
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: { email, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });
  return true;
}
