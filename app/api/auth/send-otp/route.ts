import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOtp } from "@/lib/email";
import { prisma, withRetry } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();

    // Fast path abuse control before touching external providers.
    const localLimit = checkRateLimit(`otp:send:${email}`, 6, 15 * 60 * 1000);
    if (!localLimit.allowed) {
      return NextResponse.json(
        { error: "Too many code requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(localLimit.retryAfterSec) } }
      );
    }

    // Blocked accounts get no codes; brand-new emails get none while the
    // admin has sign-ups switched off.
    const account = await withRetry(() =>
      prisma.user.findUnique({ where: { email }, select: { blockedAt: true } })
    );
    if (account?.blockedAt) {
      return NextResponse.json({ error: "This account has been blocked. Contact support if you think this is a mistake." }, { status: 403 });
    }
    if (!account) {
      const settings = await getSettings();
      if (!settings.signupsEnabled) {
        return NextResponse.json({ error: "New sign-ups are temporarily closed. Please check back soon." }, { status: 403 });
      }
    }

    // Cross-instance guard using DB history to avoid bypassing in-memory limits.
    // One query serves both checks below (15-min volume + 60s cooldown) so we
    // don't pay two round-trips to the database on the happy path.
    const now = Date.now();
    const lookback = new Date(now - 15 * 60 * 1000);
    const recentCodes = await withRetry(() =>
      prisma.otpCode.findMany({
        where: { email, createdAt: { gt: lookback } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
    );

    if (recentCodes.length >= 6) {
      return NextResponse.json(
        { error: "Too many code requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const lastSentAt = recentCodes[0]?.createdAt;
    if (lastSentAt && lastSentAt.getTime() > now - 60 * 1000) {
      return NextResponse.json(
        { error: "Please wait a minute before requesting another code." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    await sendOtp(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send OTP:", message);
    return NextResponse.json({ error: "Could not send code" }, { status: 500 });
  }
}
