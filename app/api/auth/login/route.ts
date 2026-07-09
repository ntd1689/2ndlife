import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/email";
import { createSession } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const code = parsed.data.code;

  const verifyLimit = checkRateLimit(`otp:login:${email}`, 20, 15 * 60 * 1000);
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

  const user = await withRetry(() =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true, userType: true },
    })
  );
  if (!user || user.userType !== "advertiser") {
    return NextResponse.json(
      { error: "No account found for this email. Please sign up first." },
      { status: 403 }
    );
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
