/**
 * Minimal in-memory per-IP rate limiter for /api/login brute-force defense.
 *
 * Caveats:
 * - Module-level Map is per-instance. On Vercel's serverless scale-out,
 *   each instance keeps its own counters; sustained attackers can rotate
 *   across cold starts. For a true production gate use Upstash Redis +
 *   `@upstash/ratelimit`. This is the demo-grade version.
 * - State resets on cold start. Friction remains useful even so.
 * - Bounded with a hard cap + eviction so an attacker spraying random
 *   IPs cannot bloat memory.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_BUCKETS = 10_000;

// Global backstop against IP-rotation attacks (e.g. spoofed
// X-Forwarded-For, botnets). Caps total attempts across ALL identifiers.
const GLOBAL_MAX_ATTEMPTS = 200;
let globalCounter: Bucket = { count: 0, resetAt: 0 };

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller must wait before retrying. */
  retryAfter: number;
}

function evictAndCap(now: number): void {
  // Sweep expired entries opportunistically.
  if (buckets.size > MAX_BUCKETS / 2) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  // Hard cap — Map preserves insertion order, so dropping from the
  // front removes the oldest-inserted entries.
  if (buckets.size > MAX_BUCKETS) {
    const drop = buckets.size - MAX_BUCKETS;
    const iter = buckets.keys();
    for (let i = 0; i < drop; i++) {
      const k = iter.next().value;
      if (k === undefined) break;
      buckets.delete(k);
    }
  }
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  evictAndCap(now);

  // Global backstop — applied even when `key` is empty or "unknown".
  if (!globalCounter.resetAt || globalCounter.resetAt <= now) {
    globalCounter = { count: 1, resetAt: now + WINDOW_MS };
  } else {
    globalCounter.count += 1;
    if (globalCounter.count > GLOBAL_MAX_ATTEMPTS) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((globalCounter.resetAt - now) / 1000)),
      };
    }
  }

  if (!key || key === "unknown") {
    // No usable per-IP identifier — global cap above is the only gate.
    return { allowed: true, retryAfter: 0 };
  }

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

/**
 * Extract a client identifier suitable for rate limiting.
 *
 * Trust order:
 *   1. `x-vercel-forwarded-for` — set by Vercel's edge proxy, NOT
 *      copied from client-supplied headers. Cannot be spoofed.
 *   2. `x-real-ip` — most reverse proxies set this server-side after
 *      stripping any client-supplied value.
 *   3. `x-forwarded-for` — last resort; clients CAN set this directly,
 *      but the global counter in checkLoginRateLimit() caps damage.
 *
 * If you front this app with a custom proxy other than Vercel's edge,
 * configure that proxy to strip the client-supplied X-Forwarded-For
 * before it reaches Next.js.
 */
export function clientIp(req: Request): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}
