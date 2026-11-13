import type { Language } from "../../lib/sample";
import type { Prompt, PromptTask } from "../../lib/ai-types";

/** Pieces shared by every prompt. Prompts live here, never in UI components. */

/**
 * The document is untrusted data. Any literal <document> tags inside it are
 * neutralized so the text cannot close the wrapper and smuggle instructions.
 */
export function wrapDocument(text: string): string {
  const safe = text.replace(/<\/?\s*document\s*>/gi, "[document-tag]");
  return `<document>\n${safe}\n</document>`;
}

export const LANGUAGE_GUIDANCE: Record<Language, string> = {
  fil: "Write in everyday spoken Filipino with short, simple sentences. Do not translate word for word.",
  en: "Write in plain English with short sentences.",
};

export const QUOTE_RULES =
  "Quotes must be copied exactly from the document; null if none.";

export const JSON_ONLY = "Reply with ONE JSON object only, no markdown.";

/**
 * Flattens a prompt into the single text message Lumen AI Chat accepts
 * (it has no separate system role). Used for both size checks and sending.
 */
export const renderMessage = (prompt: Prompt): string =>
  prompt.messages.map((m) => m.content).join("\n\n");

export function buildPrompt(
  task: PromptTask,
  language: Language,
  system: string[],
  user: string,
): Prompt {
  return {
    task,
    language,
    messages: [
      { role: "system", content: system.join("\n") },
      { role: "user", content: user },
    ],
  };
}
