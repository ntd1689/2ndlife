import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOtp } from "@/lib/email";
import { prisma, withRetry } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

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

    // Cross-instance guard using DB history to avoid bypassing in-memory limits.
    const lookback = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await withRetry(() =>
      prisma.otpCode.count({
        where: { email, createdAt: { gt: lookback } },
      })
    );
    if (recentCount >= 6) {
      return NextResponse.json(
        { error: "Too many code requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const cooldownCutoff = new Date(Date.now() - 60 * 1000);
    const recent = await withRetry(() =>
      prisma.otpCode.findFirst({
        where: { email, createdAt: { gt: cooldownCutoff } },
        orderBy: { createdAt: "desc" },
      })
    );
    if (recent) {
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
