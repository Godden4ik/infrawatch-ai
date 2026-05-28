/**
 * Minimal in-memory per-IP rate limiter for /api/login brute-force defense.
 *
 * Caveats:
 * - Module-level Map is per-instance. On Vercel's serverless scale-out,
 *   each instance keeps its own counters; sustained attackers can rotate
 *   across instances. For a true production gate use Upstash Redis +
 *   `@upstash/ratelimit`. This is the demo-grade version.
 * - State resets on cold start. Friction remains useful even so.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller must wait before retrying. */
  retryAfter: number;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  if (!key) {
    // No identifier — be conservative and allow, but don't track.
    return { allowed: true, retryAfter: 0 };
  }

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // First IP in the chain is the client; rest are proxies.
    return forwarded.split(",")[0]!.trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
