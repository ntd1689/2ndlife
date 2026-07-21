// Server-side Cloudflare Turnstile verification. When TURNSTILE_SECRET_KEY is
// unset (local dev, or before keys are provisioned), verification is skipped so
// the flows keep working — enforcement only turns on once the secret is set.
// Pair this with NEXT_PUBLIC_TURNSTILE_SITE_KEY on the client: set BOTH in
// production, or the widget won't render and every submission would be rejected.

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

export async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true; // not configured -> skip (dev)
  if (typeof token !== "string" || !token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip && ip !== "unknown" ? { remoteip: ip } : {}),
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Network error verifying the challenge: fail closed so a bot can't rely on
    // knocking out Cloudflare to slip through.
    return false;
  }
}
