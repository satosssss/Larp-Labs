import type { Provenance } from "../../lib/ai-types";
import { readGeminiConfig } from "./gemini-config";
import { LiveGeminiClient } from "./gemini-live";
import { GEMINI_MAX_PROMPT_CHARS } from "./limits";
import type { ChatInput, ChatModel, ChatOutput } from "./lumen-client";
import { MockLumenClient } from "./lumen-mock";

/**
 * The reasoning model used for review, explanation and follow-up chat.
 *
 * Mock mode reuses the deterministic Lumen mock's chat path, so the whole
 * pipeline (prompt -> JSON -> source checker -> guardrail -> UI) runs without
 * a key and without the network. Results carry provenance "mock" and stay
 * visibly marked in the UI.
 */
export class GeminiMockModel implements ChatModel {
  readonly provenance: Provenance = "mock";
  /** Mock mode is not bound by Lumen's 4,000-character message cap. */
  readonly maxMessageChars = GEMINI_MAX_PROMPT_CHARS;
  readonly #inner = new MockLumenClient();

  chat(input: ChatInput): Promise<ChatOutput> {
    return this.#inner.chat(input);
  }
}

export function createGeminiModel(
  env: Record<string, string | undefined> = process.env,
): ChatModel {
  return env.GEMINI_MODE === "mock"
    ? new GeminiMockModel()
    : new LiveGeminiClient(readGeminiConfig(env));
}

/** Default model for routes: reads backend env vars, throws a safe AiError if unset. */
export const chatModelFromEnv = (): ChatModel => createGeminiModel();
