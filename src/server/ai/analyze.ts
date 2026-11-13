import {
  type AiAnalysisResult,
  type GroundedClaim,
  type NoticeType,
  type UncertaintyNote,
} from "../../lib/ai-types";
import { DISCLAIMER } from "../../lib/ai-text";
import type { Language } from "../../lib/sample";
import { buildAnalyzePrompt } from "../prompts";
import { chatJson } from "./call";
import { resolveClassification } from "./document-classifier";
import { AiError } from "./errors";
import { evaluateAll } from "./guardrail";
import type { ChatModel } from "./lumen-client";
import {
  parseRawClaims,
  parseRawClassification,
  parseRawDates,
  parseRawSender,
  parseStringList,
} from "./model-output";
import {
  groundClaims,
  groundDates,
  groundSender,
  hasUnsupported,
} from "./source-checker";

/**
 * Full analysis of reviewed text in ONE model call. The reply must be valid
 * JSON; otherwise the analysis fails as a whole and nothing partial is shown
 * (design: "no partial render of unvalidated content"). The model proposes;
 * the Source Checker, classifier rules and guardrail decide what is shown.
 */
export async function analyzeDocument(
  client: ChatModel,
  input: { text: string; language: Language; noticeType?: NoticeType },
  signal?: AbortSignal,
): Promise<AiAnalysisResult> {
  const { text, language } = input;
  const json = await chatJson(
    client,
    buildAnalyzePrompt({ text, language }),
    signal,
  );

  const summary = typeof json.summary === "string" ? json.summary.trim() : "";
  if (!summary) throw new AiError("invalid_model_output");

  const classification = resolveClassification(
    parseRawClassification({
      type: json.type,
      confidence: json.confidence,
      quote: json.typeEvidence,
      reason: "",
    }),
    text,
    input.noticeType,
  );

  const { dates, rejected } = groundDates(text, parseRawDates(json.dates));
  const sender = groundSender(text, parseRawSender(json.sender));
  const importantPoints: GroundedClaim[] = groundClaims(
    text,
    parseRawClaims(json.points),
  );
  const nextSteps = parseStringList(json.nextSteps, 5);

  // Guardrail on model-authored text only, never on document quotes.
  const verdict = evaluateAll([
    summary,
    ...importantPoints.map((p) => p.text),
    ...nextSteps,
  ]);
  if (!verdict.ok) throw new AiError("guardrail_blocked");

  const notes: UncertaintyNote[] = [...classification.notes];
  if (rejected > 0) notes.push({ code: "unsupported_dates_removed" });
  if (dates.length === 0) notes.push({ code: "no_dates_found" });
  if (hasUnsupported(importantPoints))
    notes.push({ code: "unsupported_claims_removed" });

  return {
    language,
    provenance: client.provenance,
    classification,
    summary,
    importantPoints,
    sender,
    dates,
    nextSteps,
    uncertaintyNotes: notes,
    disclaimer: DISCLAIMER[language],
  };
}
