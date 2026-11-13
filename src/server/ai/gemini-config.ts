import { parseOrigin } from "./config";
import { AiError } from "./errors";

/**
 * The only place that reads the Gemini environment variables.
 * Server-only: never import this from a client component. None of the
 * variables has a NEXT_PUBLIC_ prefix, so Next.js does not bundle them for the
 * browser.
 *
 *   GEMINI_MODE=mock -> deterministic mock model, no credentials.
 *   otherwise        -> live client; needs GEMINI_API_KEY.
 *
 *   GEMINI_MODEL     -> optional, defaults to GEMINI_DEFAULT_MODEL.
 *   GEMINI_API_ORIGIN-> optional HTTPS origin for a proxy or test double.
 *
 * Missing configuration never falls back to mock; that would show fake
 * explanations to real users.
 */

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
export const GEMINI_DEFAULT_ORIGIN =
  "https://generativelanguage.googleapis.com";

export type GeminiConfig = {
  apiKey: string;
  /** Bare model id, e.g. `gemini-2.5-flash` (no `models/` prefix). */
  model: string;
  /** Scheme and host only, no path and no trailing slash. */
  origin: string;
};

type Env = Record<string, string | undefined>;

/**
 * Accepts `gemini-2.5-flash` or `models/gemini-2.5-flash`. The id becomes part
 * of a URL path, so anything outside this character set is rejected rather
 * than percent-encoded into an unexpected route.
 */
export function normalizeModel(value: string): string | null {
  const model = value.trim().replace(/^models\//, "");
  return /^[a-z0-9][a-z0-9.-]*$/i.test(model) ? model : null;
}

export function readGeminiConfig(env: Env = process.env): GeminiConfig {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiError("not_configured");
  const model = normalizeModel(env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL);
  if (!model) throw new AiError("not_configured");
  const origin = env.GEMINI_API_ORIGIN
    ? parseOrigin(env.GEMINI_API_ORIGIN)
    : GEMINI_DEFAULT_ORIGIN;
  if (!origin) throw new AiError("not_configured");
  return { apiKey, model, origin };
}
