import { prisma } from "./prisma";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(email: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Only allow one currently valid OTP per email by consuming older pending codes.
    await prisma.otpCode.updateMany({
      where: { email, consumed: false },
      data: { consumed: true },
    });

    await prisma.otpCode.create({
      data: { email, code, expiresAt },
    });
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
