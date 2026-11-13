import type { Prompt, Provenance } from "../../lib/ai-types";
import type { GeminiConfig } from "./gemini-config";
import { AiError, type AiErrorCode } from "./errors";
import {
  GEMINI_HEDGE_AFTER_MS,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MAX_PROMPT_CHARS,
} from "./limits";
import type { ChatInput, ChatModel, ChatOutput } from "./lumen-client";

/**
 * Real Gemini client, written against the public `generateContent` REST API.
 *
 * Security rules, enforced here:
 *  - the key travels only in the `x-goog-api-key` header, only over HTTPS to
 *    the configured origin, and is never logged, returned or put in an error;
 *  - errors carry only our own codes. Gemini's error `message` is never read,
 *    because it can echo request content; only status and reason are used;
 *  - responses are requested as JSON (`responseMimeType`), and every caller
 *    still parses and validates the result (see model-output.ts).
 *
 * Gemini is used for reasoning only: review, explanation and follow-up chat.
 * OCR stays on Lumen; see lumen-live.ts.
 */

export const GEMINI_KEY_HEADER = "x-goog-api-key";

type FetchLike = typeof fetch;
type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export type GeminiRequestBody = {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: "user"; parts: { text: string }[] }[];
  generationConfig: {
    responseMimeType: "application/json";
    temperature: number;
    maxOutputTokens: number;
  };
};

/**
 * Maps our provider-neutral prompt to Gemini's shape. The system role becomes
 * `systemInstruction` (Gemini has a real system role, unlike Lumen), and the
 * document stays inside the user turn so instructions cannot be confused with
 * document text.
 */
export function buildGeminiRequest(prompt: Prompt): GeminiRequestBody {
  const join = (role: "system" | "user") =>
    prompt.messages
      .filter((m) => m.role === role)
      .map((m) => m.content)
      .join("\n\n");
  const system = join("system");
  const user = join("user");
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      // Grounded extraction, not creative writing.
      temperature: 0.2,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };
}

/** True when the failure body says the API key itself is bad. */
function apiKeyInvalid(body: Json): boolean {
  const error = isRecord(body.error) ? body.error : {};
  if (error.status === "UNAUTHENTICATED") return true;
  const details = Array.isArray(error.details) ? error.details : [];
  return details.some(
    (d) => isRecord(d) && d.reason === "API_KEY_INVALID",
  );
}

/** Maps a failed Gemini response to one of our safe codes. Status and reason only. */
export function mapGeminiError(
  status: number,
  keyInvalid = false,
): AiErrorCode {
  if (keyInvalid) return "not_configured";
  if (status === 401) return "not_configured";
  // 404 is a mistyped model id, which is a configuration error, not an outage.
  if (status === 404) return "not_configured";
  if (status === 403) return "upstream_denied";
  if (status === 429) return "rate_limited";
  if (status === 400) return "invalid_request";
  return "upstream_error";
}

/**
 * Finish reasons that mean Gemini refused or could not finish the answer.
 * MAX_TOKENS matters most: a truncated reply is invalid JSON, so it must fail
 * cleanly instead of rendering a half-parsed analysis.
 */
const UNUSABLE_FINISH = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "MAX_TOKENS",
  "MALFORMED_FUNCTION_CALL",
  "OTHER",
]);

export class LiveGeminiClient implements ChatModel {
  readonly provenance: Provenance = "gemini";
  readonly maxMessageChars = GEMINI_MAX_PROMPT_CHARS;
  // Held privately and never serialized.
  readonly #config: GeminiConfig;
  readonly #fetch: FetchLike;
  /** 0 disables hedging (tests); see GEMINI_HEDGE_AFTER_MS for the reason. */
  readonly #hedgeAfterMs: number;

  constructor(
    config: GeminiConfig,
    options: { fetch?: FetchLike; hedgeAfterMs?: number } = {},
  ) {
    this.#config = config;
    this.#fetch = options.fetch ?? fetch;
    this.#hedgeAfterMs = options.hedgeAfterMs ?? GEMINI_HEDGE_AFTER_MS;
  }

  /**
   * Sends the request, and sends it a second time (in parallel) if the first
   * is still pending after `hedgeAfterMs`. The first answer wins and the other
   * request is aborted, so a stalled upstream call cannot hold the user for the
   * full timeout. A failure only surfaces once no attempt can still answer.
   */
  async chat(input: ChatInput): Promise<ChatOutput> {
    if (!(this.#hedgeAfterMs > 0)) return this.#generate(input, input.signal);

    const attempts: AbortController[] = [];
    const onOuterAbort = () => {
      for (const attempt of attempts) attempt.abort();
    };
    input.signal?.addEventListener("abort", onOuterAbort, { once: true });

    const launch = () => {
      const attempt = new AbortController();
      attempts.push(attempt);
      // The caller may have aborted between two launches.
      if (input.signal?.aborted) attempt.abort();
      return this.#generate(input, attempt.signal);
    };

    let hedge: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<ChatOutput>((resolve, reject) => {
        let settled = false;
        let launched = 0;
        let failed = 0;
        let lastError: unknown;

        const finish = (settle: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(hedge);
          settle();
        };

        const start = () => {
          launched += 1;
          launch().then(
            (out) => finish(() => resolve(out)),
            (error) => {
              failed += 1;
              lastError = error;
              // Give up only when every attempt so far has failed.
              if (failed === launched) finish(() => reject(lastError));
            },
          );
        };

        start();
        hedge = setTimeout(() => {
          if (!settled) start();
        }, this.#hedgeAfterMs);
      });
    } finally {
      clearTimeout(hedge);
      input.signal?.removeEventListener("abort", onOuterAbort);
      // Cancels the loser; a no-op for requests that already finished.
      for (const attempt of attempts) attempt.abort();
    }
  }

  async #generate(
    input: ChatInput,
    signal: AbortSignal | undefined,
  ): Promise<ChatOutput> {
    const { prompt } = input;
    const body = buildGeminiRequest(prompt);
    const url =
      `${this.#config.origin}/v1beta/models/` +
      `${encodeURIComponent(this.#config.model)}:generateContent`;

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [GEMINI_KEY_HEADER]: this.#config.apiKey,
        },
        body: JSON.stringify(body),
        signal,
        // Never follow a redirect with the key attached.
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      throw new AiError(signal?.aborted ? "timeout" : "upstream_error");
    }

    let json: Json = {};
    try {
      const parsed: unknown = await response.json();
      if (isRecord(parsed)) json = parsed;
    } catch {
      // Empty or non-JSON body: handled by the status check below.
    }

    if (!response.ok)
      throw new AiError(mapGeminiError(response.status, apiKeyInvalid(json)));

    // The prompt itself was blocked before any candidate was produced.
    if (isRecord(json.promptFeedback) && json.promptFeedback.blockReason)
      throw new AiError(
        prompt.task === "qa" ? "out_of_scope" : "invalid_model_output",
      );

    const candidate = Array.isArray(json.candidates)
      ? json.candidates[0]
      : undefined;
    if (!isRecord(candidate)) throw new AiError("invalid_model_output");

    const finishReason =
      typeof candidate.finishReason === "string" ? candidate.finishReason : "";
    if (UNUSABLE_FINISH.has(finishReason))
      throw new AiError(
        prompt.task === "qa" ? "out_of_scope" : "invalid_model_output",
      );

    const content = isRecord(candidate.content) ? candidate.content : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const text = parts
      .flatMap((part) =>
        isRecord(part) && typeof part.text === "string" ? [part.text] : [],
      )
      .join("");
    if (!text.trim()) throw new AiError("invalid_model_output");

    return { text };
  }
}
