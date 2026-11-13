import { AiError } from "./errors";
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./limits";

/**
 * Best-effort sliding-window limiter, in memory. Every live Lumen call costs
 * credits and the endpoints are public, so this stops a single client from
 * draining them. It is per server instance: on serverless hosting each
 * instance counts separately, so a shared store (for example the planned
 * Supabase `rate_limits` table) is still needed for a hard guarantee.
 */
export class RateLimitError extends AiError {
  constructor(readonly retryAfterSeconds: number) {
    super("rate_limited");
  }
}

const MAX_TRACKED_CLIENTS = 10_000;

export class RateLimiter {
  readonly #hits = new Map<string, number[]>();

  constructor(
    private readonly max = RATE_LIMIT_MAX_REQUESTS,
    private readonly windowMs = RATE_LIMIT_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a request or throws RateLimitError. Denied requests are not counted. */
  check(key: string): void {
    const now = this.now();
    const recent = (this.#hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.#hits.set(key, recent);
      const oldest = recent[0];
      throw new RateLimitError(
        Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      );
    }
    recent.push(now);
    this.#hits.set(key, recent);
    if (this.#hits.size > MAX_TRACKED_CLIENTS) this.#prune(now);
  }

  #prune(now: number) {
    for (const [key, times] of this.#hits)
      if (!times.some((t) => now - t < this.windowMs)) this.#hits.delete(key);
  }
}

/** First hop of x-forwarded-for, else x-real-ip, else a shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}
