export type RateRule = { limit: number; windowSec: number };
export type RateResult = { allowed: boolean; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };
const g = globalThis as { __ll_rl?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__ll_rl ??= new Map());

/**
 * Fixed-window limiter. In-memory, so it is per serverless instance (best
 * effort only). For production on Vercel, replace this function with a
 * shared-store implementation (e.g. Supabase) that keeps the same signature.
 */
export async function rateLimit(
  key: string,
  rule: RateRule,
  now = Date.now(),
): Promise<RateResult> {
  if (buckets.size > 5000)
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowSec * 1000 });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (b.count >= rule.limit)
    return {
      allowed: false,
      retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
    };
  b.count++;
  return { allowed: true, retryAfterSec: 0 };
}

export const RULES = {
  upload: { limit: 10, windowSec: 60 },
  ai: { limit: 20, windowSec: 60 },
  read: { limit: 60, windowSec: 60 },
  write: { limit: 20, windowSec: 60 },
} satisfies Record<string, RateRule>;
