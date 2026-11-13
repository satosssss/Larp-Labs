import type { AiChatResult } from "../../lib/ai-types";
import { ADVICE_DECLINED, DISCLAIMER, NOT_STATED } from "../../lib/ai-text";
import type { Language } from "../../lib/sample";
import { buildGroundedQaPrompt } from "../prompts";
import { chatJson } from "./call";
import { AiError } from "./errors";
import { evaluateAll, isAdviceRequest } from "./guardrail";
import type { LumenClient } from "./lumen-client";
import { parseRawClaims } from "./model-output";
import { groundClaims } from "./source-checker";

/**
 * Source-grounded follow-up answer. The document text is the only context.
 * - Advice or outcome questions are declined deterministically (Req 15.3).
 * - "Answered from the document" is only kept if at least one claim has a
 *   verified quote; otherwise the answer is relabeled "not stated" and gets no
 *   source link (Req 8.3, 14.9).
 * - Model-authored text goes through the guardrail before it is returned.
 */
export async function answerQuestion(
  client: LumenClient,
  input: { text: string; question: string; language: Language },
  signal?: AbortSignal,
): Promise<AiChatResult> {
  const { text, question, language } = input;
  const json = await chatJson(
    client,
    buildGroundedQaPrompt({ text, question, language }),
    signal,
    { proseIsRefusal: true },
  );

  const modelAnswer = typeof json.answer === "string" ? json.answer.trim() : "";
  if (!modelAnswer) throw new AiError("invalid_model_output");
  const claims = groundClaims(text, parseRawClaims(json.claims));

  if (!evaluateAll([modelAnswer, ...claims.map((c) => c.text)]).ok)
    throw new AiError("guardrail_blocked");

  const advice = isAdviceRequest(question) || json.declined === true;
  const supported = claims.some((c) => c.status === "supported");
  const answeredFromDocument = json.answeredFromDocument === true && supported;

  let answer = modelAnswer;
  if (!answeredFromDocument && !answer.startsWith(NOT_STATED[language]))
    answer = `${NOT_STATED[language]} ${answer}`;
  // Declining is our wording, not the model's, so a model slip cannot skip it.
  if (advice) answer = `${ADVICE_DECLINED[language]} ${answer}`;

  return {
    language,
    provenance: client.provenance,
    answer,
    claims,
    answeredFromDocument,
    declined: advice,
    disclaimer: DISCLAIMER[language],
  };
}
