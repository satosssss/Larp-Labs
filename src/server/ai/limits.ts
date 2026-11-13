/** Server-enforced limits. Sources: spec Req 1, 4.9, 14.2 and the Lumen API docs. */
export const MAX_FILE_BYTES = 10_485_760; // 10 MB (also Lumen's upload limit)
export const MAX_PDF_PAGES = 10;
/** The spec limit. The frontend currently allows 100,000; see the Stage 2 report. */
export const MAX_TEXT_CHARS = 20_000;
export const MAX_QUESTION_CHARS = 500;
/** JSON request bodies larger than this are refused before parsing. */
export const MAX_JSON_BYTES = 200_000;
/** Multipart overhead allowance on top of MAX_FILE_BYTES. */
export const MULTIPART_OVERHEAD_BYTES = 64_000;
export const OCR_TIMEOUT_MS = 60_000;
/** Lumen answers a chat turn within 25 s or ends it with a 504. */
export const CHAT_TIMEOUT_MS = 45_000;

/**
 * Gemini's flash-lite line answers in ~1-2s most of the time but occasionally
 * stalls for 15-35s on the same prompt, so a single request has a long tail.
 * After this delay a second identical request is sent and the first answer
 * wins; the loser is aborted. Both requests are stateless, so a duplicate is
 * harmless, and flash-lite is cheap enough to pay for occasionally.
 */
export const GEMINI_HEDGE_AFTER_MS = 5_000;

/**
 * Lumen AI Chat accepts 1-4000 characters per message and has no separate
 * system prompt, so our instructions and the document share this budget.
 * We stay under the limit by a margin in case Lumen counts characters
 * differently from JavaScript string length.
 */
export const LUMEN_MESSAGE_MAX_CHARS = 4000;
export const MESSAGE_BUDGET_CHARS = 3900;

/**
 * Gemini takes a much larger prompt than Lumen. The reviewed text is already
 * capped at MAX_TEXT_CHARS (20,000), so this budget is a safety net rather
 * than a real constraint.
 */
export const GEMINI_MAX_PROMPT_CHARS = 100_000;
/** Enough for the analyze JSON (summary, claims, dates, next steps). */
export const GEMINI_MAX_OUTPUT_TOKENS = 4_096;

/** OCR polling: start quick, back off, never exceed the OCR timeout. */
export const OCR_POLL_INITIAL_MS = 1_000;
export const OCR_POLL_MAX_MS = 3_000;

/** Best-effort per-client request limit (in memory). Spec Req 24.8: 20 per 10 min. */
export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
