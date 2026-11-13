import type { Language } from "../../lib/sample";
import { CLASSIFY_RULES } from "./classify";
import { DATES_RULES } from "./dates";
import { EXPLAIN_RULES } from "./explain";
import { KEY_INFO_RULES } from "./key-info";
import { SAFETY_AND_UNCERTAINTY_RULES } from "./safety";
import {
  JSON_ONLY,
  LANGUAGE_GUIDANCE,
  QUOTE_RULES,
  buildPrompt,
  wrapDocument,
} from "./shared";

/**
 * Combined analysis message: classification, dates, key info and explanation in
 * ONE Lumen call (5 credits instead of 20). The reply shape is parsed by
 * ../ai/analyze.ts. Every character counts: the instructions and the document
 * share Lumen's 4000-character message limit.
 */
export const ANALYZE_SHAPE =
  '{"type":"","confidence":0-100,"typeEvidence":""|null,"summary":"",' +
  '"sender":{"name":"","quote":""}|null,' +
  '"dates":[{"kind":"deadline|appearance|hearing|other","label":"","dateText":"","timeText":""|null,"quote":""}],' +
  '"points":[{"text":"","kind":"date|amount|party|action|consequence|other","basis":"document|general","quote":""|null}],' +
  '"nextSteps":[""]}';

export function buildAnalyzePrompt(input: {
  text: string;
  language: Language;
}) {
  return buildPrompt(
    "analyze",
    input.language,
    [
      SAFETY_AND_UNCERTAINTY_RULES,
      JSON_ONLY,
      `Shape: ${ANALYZE_SHAPE}`,
      CLASSIFY_RULES,
      DATES_RULES,
      KEY_INFO_RULES,
      EXPLAIN_RULES,
      QUOTE_RULES,
      LANGUAGE_GUIDANCE[input.language],
    ],
    wrapDocument(input.text),
  );
}
