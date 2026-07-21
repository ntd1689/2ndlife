import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/admin";
import { redisHealth } from "@/lib/rate-limit";
import { turnstileEnabled } from "@/lib/turnstile";

// Admin-only status of the abuse-protection infrastructure: whether the durable
// rate limiter is talking to Upstash Redis or falling back to in-memory, and
// whether the Turnstile bot challenge is configured.
export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const redis = await redisHealth();
  return NextResponse.json({ redis, turnstile: { configured: turnstileEnabled() } });
}
