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

export interface LumenClient {
  readonly provenance: Provenance;
  /** Largest chat message the backend accepts, in characters. */
  readonly maxMessageChars: number;
  ocr(input: OcrInput): Promise<OcrOutput>;
  chat(input: ChatInput): Promise<ChatOutput>;
}

export function createLumenClient(config: LumenConfig): LumenClient {
  return config.mode === "mock"
    ? new MockLumenClient()
    : new LiveLumenClient(config);
}

/** Default client for routes: reads backend env vars, throws a safe AiError if unset. */
export const clientFromEnv = (): LumenClient =>
  createLumenClient(readLumenConfig());
