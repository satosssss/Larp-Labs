import type { Prompt, Provenance } from "../../lib/ai-types";
import { readLumenConfig, type LumenConfig } from "./config";
import { LiveLumenClient } from "./lumen-live";
import { MockLumenClient } from "./lumen-mock";

/**
 * Our own abstraction over Lumen. Both the mock and the live client implement
 * it, so the AI modules, routes and frontend never change when one replaces
 * the other.
 *
 * `chat` returns the model's raw text. Every caller parses and validates it
 * (see model-output.ts), so the mock exercises exactly the same code paths.
 */

export type AcceptedMime = "image/jpeg" | "image/png" | "application/pdf";

export type OcrInput = {
  bytes: Uint8Array;
  mime: AcceptedMime;
  signal?: AbortSignal;
};
export type OcrPage = {
  page: number;
  text: string;
  /** Engine confidence for the page as an integer 0-100, when measured. */
  confidence?: number;
};
export type OcrOutput = {
  text: string;
  pages?: OcrPage[];
  /** Pages the engine failed to read. Non-empty means the text is incomplete. */
  failedPages?: number[];
};
export type ChatInput = { prompt: Prompt; signal?: AbortSignal };
export type ChatOutput = { text: string };

/**
 * Narrow capabilities, so each provider is bound to one job:
 *  - `OcrClient`  reads a document. Lumen owns this.
 *  - `ChatModel`  answers a prompt with text. Gemini owns this.
 * `LumenClient` still satisfies both, which keeps the mock in one class.
 */

export interface OcrClient {
  readonly provenance: Provenance;
  ocr(input: OcrInput): Promise<OcrOutput>;
}

export interface ChatModel {
  readonly provenance: Provenance;
  /**
   * Largest prompt this backend accepts, in characters. The prompt is never
   * silently truncated: an over-limit document fails with `document_too_long`
   * and the user shortens it in the review step.
   */
  readonly maxMessageChars: number;
  chat(input: ChatInput): Promise<ChatOutput>;
}

export interface LumenClient extends OcrClient, ChatModel {}

export function createLumenClient(config: LumenConfig): LumenClient {
  return config.mode === "mock"
    ? new MockLumenClient()
    : new LiveLumenClient(config);
}

/** Default client for routes: reads backend env vars, throws a safe AiError if unset. */
export const clientFromEnv = (): LumenClient =>
  createLumenClient(readLumenConfig());

/**
 * OCR-only client for the routes. Lumen is bound here and nowhere else:
 * analysis and chat answers come from the Gemini client (see gemini-client.ts).
 */
export const ocrClientFromEnv = (): OcrClient => clientFromEnv();
