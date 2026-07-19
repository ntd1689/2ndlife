import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/email";
import { prisma, withRetry } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const code = parsed.data.code;

    const verifyLimit = checkRateLimit(`otp:verify:${email}`, 20, 15 * 60 * 1000);
    if (!verifyLimit.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(verifyLimit.retryAfterSec) } }
      );
    }

    const ok = await verifyOtp(email, code);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect or expired code" }, { status: 400 });
    }

    // Enforce blocking and the sign-ups switch even if a code was somehow
    // obtained (e.g. requested before the block/switch happened).
    const existing = await withRetry(() =>
      prisma.user.findUnique({ where: { email }, select: { blockedAt: true } })
    );
    if (existing?.blockedAt) {
      return NextResponse.json({ error: "This account has been blocked. Contact support if you think this is a mistake." }, { status: 403 });
    }
    if (!existing) {
      const settings = await getSettings();
      if (!settings.signupsEnabled) {
        return NextResponse.json({ error: "New sign-ups are temporarily closed. Please check back soon." }, { status: 403 });
      }
    }

    const user = await withRetry(() =>
      prisma.user.upsert({
        where: { email },
        update: { emailVerified: true },
        create: { email, emailVerified: true },
      })
    );

    await createSession(user.id);

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to verify OTP:", message);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
