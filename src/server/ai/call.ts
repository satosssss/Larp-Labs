import type { Prompt } from "../../lib/ai-types";
import { renderMessage } from "../prompts/shared";
import { AiError } from "./errors";
import { CHAT_TIMEOUT_MS, MESSAGE_BUDGET_CHARS } from "./limits";
import type { LumenClient } from "./lumen-client";
import { parseJsonObject } from "./model-output";

/**
 * Runs a promise-returning function with a hard timeout and cancellation.
 * Any failure that is not already an AiError becomes a generic one, so
 * upstream messages (which could echo input) never reach users or logs.
 */
export async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener("abort", onOuterAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AiError("timeout"));
        }, ms);
      }),
    ]);
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError(outer?.aborted ? "timeout" : "upstream_error");
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Refuses a prompt that would not fit in one chat message, before anything is
 * sent. The document is never silently truncated: the user is told it is too
 * long and can shorten it in the review step.
 */
export function assertFitsMessage(client: LumenClient, prompt: Prompt) {
  const limit = Math.min(MESSAGE_BUDGET_CHARS, client.maxMessageChars);
  if (renderMessage(prompt).length > limit)
    throw new AiError("document_too_long");
}

/**
 * A short reply with no JSON at all is the service declining to answer in
 * prose (the Lumen chat instance has a built-in scope check that returns a
 * canned sentence). Broken or truncated JSON contains braces and is not this.
 */
const REFUSAL_MAX_CHARS = 400;
const looksLikeProseRefusal = (text: string) =>
  text.trim().length > 0 &&
  text.length <= REFUSAL_MAX_CHARS &&
  !/[{}[\]]/.test(text);

/**
 * Sends a prompt and returns the parsed JSON object, or throws
 * invalid_model_output. With `proseIsRefusal`, a short plain-text reply is
 * reported as out_of_scope instead, because retrying will not change it.
 */
export async function chatJson(
  client: LumenClient,
  prompt: Prompt,
  outer?: AbortSignal,
  options: { proseIsRefusal?: boolean } = {},
): Promise<Record<string, unknown>> {
  assertFitsMessage(client, prompt);
  const reply = await withTimeout(
    CHAT_TIMEOUT_MS,
    (signal) => client.chat({ prompt, signal }),
    outer,
  );
  const text = typeof reply?.text === "string" ? reply.text : "";
  const parsed = parseJsonObject(text);
  if (parsed) return parsed;
  if (options.proseIsRefusal && looksLikeProseRefusal(text))
    throw new AiError("out_of_scope");
  throw new AiError("invalid_model_output");
}
