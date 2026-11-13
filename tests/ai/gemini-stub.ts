import type { ChatModel } from "../../src/server/ai/lumen-client";
import { MockLumenClient } from "../../src/server/ai/lumen-mock";

/**
 * A `ChatModel` that reports itself as live Gemini while answering with the
 * deterministic mock's JSON. Route tests use it to exercise routing, provenance
 * labels and rate limiting without the network. Gemini's wire format is covered
 * separately in tests/ai/gemini.test.ts.
 */
export function geminiStub(
  inner: Pick<MockLumenClient, "chat"> = new MockLumenClient(),
): ChatModel {
  return {
    provenance: "gemini",
    maxMessageChars: 100_000,
    chat: (input) => inner.chat(input),
  };
}
