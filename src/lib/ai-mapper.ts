import type { ChatResult } from "./gateway";
import type { AiAnalysisResult, AiChatResult, Evidence } from "./ai-types";
import { NOTICE_TYPE_LABEL, NOT_STATED, NOT_STATED_SHORT } from "./ai-text";
import type { Analysis } from "./sample";

/**
 * Adapts rich AI results to the frontend's small view models, without changing
 * the frontend. Pure, no I/O. Mock results are visibly marked because the
 * frontend has no provenance field.
 */

export const MOCK_MARK = "[MOCK - not from Lumen]";

/** The single passage the frontend highlights. Always a verified exact slice. */
function primaryEvidence(result: AiAnalysisResult): Evidence | null {
  return (
    result.dates[0]?.evidence ??
    result.sender?.evidence ??
    result.importantPoints.find((p) => p.status === "supported")?.evidence ??
    result.classification.evidence ??
    null
  );
}

/**
 * Returns null when nothing in the result is backed by the document. The
 * frontend's acceptAnalysis requires an exact-substring quote, so an
 * unsupported result must not be shown as a normal explanation.
 */
export function toFrontendAnalysis(result: AiAnalysisResult): Analysis | null {
  const evidence = primaryEvidence(result);
  if (!evidence) return null;
  const { language } = result;
  const first = result.dates[0];
  const mark = result.provenance === "mock" ? `${MOCK_MARK} ` : "";
  const supportedPoints = result.importantPoints
    .filter((p) => p.status === "supported")
    .map((p) => p.text);
  return {
    language,
    type: `${mark}${NOTICE_TYPE_LABEL[result.classification.type][language]}`,
    summary: `${mark}${result.summary}`,
    quote: evidence.quote,
    explanation: supportedPoints.join(" ") || result.summary,
    date: first?.dateText ?? NOT_STATED_SHORT[language],
    time: first?.timeText ?? NOT_STATED_SHORT[language],
    sender: result.sender?.name ?? NOT_STATED_SHORT[language],
  };
}

export function toFrontendChat(result: AiChatResult): ChatResult {
  const mark = result.provenance === "mock" ? `${MOCK_MARK} ` : "";
  const quote = result.claims.find((c) => c.status === "supported")?.evidence
    ?.quote;
  // An answer the document does not support never gets a source link.
  const text =
    !result.answeredFromDocument &&
    !result.declined &&
    !result.answer.startsWith(NOT_STATED[result.language])
      ? `${NOT_STATED[result.language]} ${result.answer}`
      : result.answer;
  return {
    text: `${mark}${text}`,
    ...(result.answeredFromDocument && quote ? { quote } : {}),
  };
}
