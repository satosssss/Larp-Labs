import { AiError } from "./errors";

/**
 * The only place that reads the Lumen environment variables.
 * Server-only: never import this from a client component. None of the
 * variables has a NEXT_PUBLIC_ prefix, so Next.js does not bundle them for the
 * browser.
 *
 *   LUMEN_MODE=mock           -> deterministic mock client, no credentials.
 *   otherwise                 -> live client; needs LUMEN_API_KEY,
 *                                LUMEN_API_SECRET and LUMEN_API_ORIGIN.
 *   LUMEN_AI_CHAT_INSTANCE_ID -> optional; if unset, the first ACTIVE
 *                                instance the key can see is used.
 *
 * Missing configuration never falls back to mock; that would show fake
 * explanations to real users.
 */

export type LiveLumenConfig = {
  mode: "live";
  apiKey: string;
  apiSecret: string;
  /** Scheme and host only, e.g. https://api.example.com (no path, no slash). */
  origin: string;
  instanceId?: string;
};
export type LumenConfig = { mode: "mock" } | LiveLumenConfig;

type Env = Record<string, string | undefined>;

/**
 * Credentials are only ever sent over HTTPS to a bare origin. A path, query,
 * fragment or embedded user:password is rejected, so a typo in .env cannot
 * redirect credentials somewhere unexpected or into a URL.
 */
export function parseOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  return url.origin;
}

export function readLumenConfig(env: Env = process.env): LumenConfig {
  if (env.LUMEN_MODE === "mock") return { mode: "mock" };
  const apiKey = env.LUMEN_API_KEY?.trim();
  const apiSecret = env.LUMEN_API_SECRET?.trim();
  const origin = env.LUMEN_API_ORIGIN
    ? parseOrigin(env.LUMEN_API_ORIGIN)
    : null;
  if (!apiKey || !apiSecret || !origin) throw new AiError("not_configured");
  const instanceId = env.LUMEN_AI_CHAT_INSTANCE_ID?.trim();
  return {
    mode: "live",
    apiKey,
    apiSecret,
    origin,
    ...(instanceId ? { instanceId } : {}),
  };
}
