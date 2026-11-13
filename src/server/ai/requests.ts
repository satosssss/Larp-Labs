import type { NoticeType } from "../../lib/ai-types";
import type { Language } from "../../lib/sample";
import { isNoticeType } from "./document-classifier";
import { AiError } from "./errors";
import { MAX_QUESTION_CHARS, MAX_TEXT_CHARS } from "./limits";

/**
 * Hand-written request validation. There are only two small JSON shapes, so
 * no schema library is needed (Zod is not added). Unknown fields are ignored.
 */

export type AnalyzeRequest = {
  text: string;
  language: Language;
  noticeType?: NoticeType;
};
export type ChatRequest = {
  text: string;
  question: string;
  language: Language;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const parseLanguage = (value: unknown): Language =>
  value === "en" ? "en" : "fil";

function reviewedText(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new AiError("invalid_request");
  if (value.length > MAX_TEXT_CHARS) throw new AiError("text_too_long");
  return value;
}

export function parseAnalyzeRequest(body: unknown): AnalyzeRequest {
  if (!isRecord(body)) throw new AiError("invalid_request");
  const request: AnalyzeRequest = {
    text: reviewedText(body.text),
    language: parseLanguage(body.language),
  };
  if (body.noticeType !== undefined) {
    if (!isNoticeType(body.noticeType)) throw new AiError("invalid_request");
    request.noticeType = body.noticeType;
  }
  return request;
}

export function parseChatRequest(body: unknown): ChatRequest {
  if (!isRecord(body)) throw new AiError("invalid_request");
  const question = body.question;
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.length > MAX_QUESTION_CHARS
  )
    throw new AiError("invalid_request");
  return {
    text: reviewedText(body.text),
    question,
    language: parseLanguage(body.language),
  };
}
