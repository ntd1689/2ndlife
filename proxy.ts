import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function securityHeaders(req: NextRequest, res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");

  // React/Turbopack dev mode needs 'unsafe-eval'; production never uses eval,
  // so it stays out of the CSP there.
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.sandbox.paypal.com"
      : "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com";

  const csp = [
    "default-src 'self'",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: blob:",
    "style-src 'self' 'unsafe-inline' https:",
    scriptSrc,
    "connect-src 'self' https:",
    "frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  if (req.nextUrl.protocol === "https:") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
}

function maybeRateLimitApi(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  const policies: Array<{ match: RegExp; max: number; windowMs: number }> = [
    { match: /^\/api\/auth\/send-otp$/, max: 8, windowMs: 15 * 60 * 1000 },
    { match: /^\/api\/auth\/(verify-otp|login)$/, max: 30, windowMs: 15 * 60 * 1000 },
    { match: /^\/api\/uploads\/presign$/, max: 120, windowMs: 5 * 60 * 1000 },
    { match: /^\/api\/payments\/paypal\/(create-order|capture|webhook)$/, max: 60, windowMs: 5 * 60 * 1000 },
    { match: /^\/api\/listings\/[^/]+\/report$/, max: 10, windowMs: 15 * 60 * 1000 },
    { match: /^\/api\/listings/, max: 240, windowMs: 5 * 60 * 1000 },
    { match: /^\/api\/offers\//, max: 60, windowMs: 5 * 60 * 1000 },
    { match: /^\/api\/search\//, max: 240, windowMs: 5 * 60 * 1000 },
    { match: /^\/api\/admin\//, max: 300, windowMs: 5 * 60 * 1000 },
  ];

  const policy = policies.find((p) => p.match.test(pathname));
  if (!policy) return null;

  const key = `${pathname}:${ip}`;
  const decision = checkRateLimit(key, policy.max, policy.windowMs);

  if (decision.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSec),
      },
    }
  );
}

export function proxy(req: NextRequest) {
  const limited = maybeRateLimitApi(req);
  if (limited) {
    securityHeaders(req, limited);
    return limited;
  }

  const res = NextResponse.next();
  securityHeaders(req, res);
  return res;
}

export const config = {
  matcher: ["/:path*"],
};
