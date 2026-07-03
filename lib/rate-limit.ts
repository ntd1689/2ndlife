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
