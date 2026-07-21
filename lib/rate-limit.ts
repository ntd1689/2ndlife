type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

function gcExpired(current: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= current) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const current = nowMs();
  if (buckets.size > 20000) {
    gcExpired(current);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= current) {
    buckets.set(key, { count: 1, resetAt: current + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, max - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const allowed = existing.count <= max;
  return {
    allowed,
    remaining: Math.max(0, max - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - current) / 1000)),
  };
}

// Best-effort client IP from the proxy headers Vercel sets. Used to key
// bot/abuse limits by network, not just by (easily rotated) email.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// Reports what the durable rate limiter is actually doing: "redis" when Upstash
// is configured and reachable (PING -> PONG), else "memory" (the in-memory
// fallback). Used by the admin health check.
export async function redisHealth(): Promise<{
  configured: boolean;
  mode: "redis" | "memory";
  connected: boolean;
  latencyMs: number | null;
  error?: string;
}> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return { configured: false, mode: "memory", connected: false, latencyMs: null };

  const started = nowMs();
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const latencyMs = nowMs() - started;
    if (!res.ok) return { configured: true, mode: "memory", connected: false, latencyMs, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { result?: string };
    const connected = data?.result === "PONG";
    return { configured: true, mode: connected ? "redis" : "memory", connected, latencyMs };
  } catch (err) {
    return {
      configured: true,
      mode: "memory",
      connected: false,
      latencyMs: nowMs() - started,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Durable, cross-instance rate limit backed by Upstash Redis (fixed window via
// INCR + PEXPIRE). Falls back to the in-memory limiter when Upstash isn't
// configured (local dev) or on any Redis error, so a limiter outage never
// blocks real traffic. The in-memory limiter is per-serverless-instance and
// resets on cold start, so use this — not checkRateLimit — for abuse control.
export async function rateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return checkRateLimit(key, max, windowMs);

  const windowId = Math.floor(nowMs() / windowMs);
  const windowKey = `rl:${key}:${windowId}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", windowKey],
        ["PEXPIRE", windowKey, windowMs, "NX"],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return checkRateLimit(key, max, windowMs);
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (!count) return checkRateLimit(key, max, windowMs);
    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  } catch {
    return checkRateLimit(key, max, windowMs);
  }
}
