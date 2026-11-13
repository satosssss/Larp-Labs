import type { Language } from "../../lib/sample";
import { ADVICE_DECLINED, GUARDRAIL_WITHHELD } from "../../lib/ai-text";

/**
 * Legal safety guardrail (Req 15). Pure, synchronous, English and Filipino.
 *
 * This is a deterministic backstop layered on top of the prompt rules, not a
 * complete legal-advice detector. It errs toward withholding. Two narrow
 * exemptions keep explanations usable:
 *  - directive rules do not fire on sentences that attribute the instruction
 *    to the document ("the letter says you must pay", "ayon sa liham"), because
 *    explaining what a notice asks is the product's job;
 *  - outcome rules do not fire on explicit declines ("I cannot predict
 *    whether you will win"), which the chat must be able to say.
 * Run it on model-authored text only (summary, points, answers, next steps),
 * never on quotes copied from the document.
 */

export type GuardrailRule = "outcome" | "directive";
export type GuardrailVerdict =
  { ok: true } | { ok: false; rule: GuardrailRule };

const SUBJECT = String.raw`you\s*(?:'ll|\s+will|\s+won't|\s+will\s+not|\s+would|\s+wouldn't|\s+are\s+going\s+to|\s+are\s+not\s+going\s+to)`;
const OUTCOME_EN = new RegExp(
  String.raw`\b${SUBJECT}\s+(?:definitely\s+|surely\s+|probably\s+|likely\s+)?(?:win|lose(?!\s+(?:the|your|any)\s+(?:right|chance|opportunity|ability))|be\s+(?:acquitted|convicted|jailed|imprisoned|arrested|cleared|found\s+(?:guilty|innocent|liable))|go\s+to\s+(?:jail|prison)|get\s+(?:acquitted|convicted|jailed|arrested))\b`,
  "i",
);
const OUTCOME_COURT_EN =
  /\bthe\s+(?:court|judge)\s+(?:will|would)\s+(?:rule|decide|find|side)\s+(?:in\s+your\s+favou?r|against\s+you)\b/i;
const OUTCOME_FIL =
  /\b(?:(?:mananalo|matatalo|makukulong|ikukulong|makakalaya|mapapawalang[- ]sala)\s+(?:ka|ako|kayo)|(?:panalo|talo)\s+ka|(?:ka|kayo|ikaw)\s+(?:ay\s+)?(?:mananalo|matatalo|makukulong|mapapawalang[- ]sala))\b/i;
const OUTCOME_RULES = [OUTCOME_EN, OUTCOME_COURT_EN, OUTCOME_FIL];

const DIRECTIVE_EN = [
  /\b(?:you\s+(?:should|must|need\s+to|have\s+to|ought\s+to|had\s+better)|i\s+(?:advise|recommend|suggest)\s+(?:that\s+)?you(?:\s+to)?)\s+(?:plead|sign|settle|pay|ignore|skip)\b/i,
  /\byou\s+(?:can|may|could)\s+(?:safely\s+)?(?:ignore|skip)\b/i,
  /\b(?:do\s+not|don't|never)\s+(?:attend|appear|show\s+up)\b/i,
  /\bplead\s+(?:not\s+)?guilty\b/i,
  /^\s*(?:plead|sign|settle|ignore|skip)\b/i,
  /^\s*pay\b(?!\s+attention)/i,
];
const PRONOUN = String.raw`(?:ka|mo|kang|mong|kayong|ninyo|ninyong|n'yo|n'yong|nyo|nyong)`;
const DIRECTIVE_FIL = [
  new RegExp(
    String.raw`\b(?:dapat|kailangan|mas\s+mabuting|mabuting)\s+${PRONOUN}?\s*(?:na\s+)?(?:pumirma|magbayad|mag-bayad|makipag-?areglo|makipagkasundo|umamin|balewalain|laktawan)\b`,
    "i",
  ),
  /\b(?:pumirma|magbayad|mag-bayad|makipag-?areglo|umamin)\s+(?:ka|kayo)\b/i,
  new RegExp(
    String.raw`\bhuwag\s+${PRONOUN}?\s*(?:ng\s+)?(?:pansinin|dumalo|sumipot|sagutin)\b`,
    "i",
  ),
  /\bhuwag\s+(?:na\s+)?(?:pansinin|dumalo|sumipot)\b/i,
];
const DIRECTIVE_RULES = [...DIRECTIVE_EN, ...DIRECTIVE_FIL];

const ATTRIBUTION =
  /\b(?:the\s+(?:letter|notice|document|message|subpoena|summons)\s+(?:says?|states?|asks?|requires?|demands?|tells?|orders?|instructs?|directs?)|according\s+to|it\s+(?:says|states)|ayon\s+sa|nakasaad|nakasulat|sinasabi\s+ng|hinihingi\s+ng|hinihiling\s+ng|iniuutos\s+ng|inuutusan)\b/i;

const DECLINE =
  /(?:cannot|can't|can\s+not|unable\s+to|not\s+able\s+to|do\s+not|don't|won't|will\s+not)\s+(?:predict|say|tell|know|promise|guarantee)|hindi\s+(?:ko|namin|kami|ako)\s+(?:masasabi|mahuhulaan|matitiyak|maipapangako|makapagsasabi|makapaghuhula)/i;
const CONDITIONAL = /\b(?:whether|if|kung|o\s+hindi)\b/i;

const splitSentences = (text: string) =>
  text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());

function isDeclineOfPrediction(sentence: string, matchIndex: number): boolean {
  const decline = DECLINE.exec(sentence);
  const conditional = CONDITIONAL.exec(sentence);
  return (
    !!decline &&
    !!conditional &&
    decline.index < conditional.index &&
    conditional.index < matchIndex
  );
}

export function evaluate(text: string): GuardrailVerdict {
  for (const sentence of splitSentences(text)) {
    for (const rule of OUTCOME_RULES) {
      const match = rule.exec(sentence);
      if (match && !isDeclineOfPrediction(sentence, match.index))
        return { ok: false, rule: "outcome" };
    }
    if (ATTRIBUTION.test(sentence)) continue;
    if (DIRECTIVE_RULES.some((rule) => rule.test(sentence)))
      return { ok: false, rule: "directive" };
  }
  return { ok: true };
}

export function evaluateAll(texts: string[]): GuardrailVerdict {
  for (const text of texts) {
    const verdict = evaluate(text);
    if (!verdict.ok) return verdict;
  }
  return { ok: true };
}

const ADVICE_REQUEST = [
  /\b(?:should\s+i|do\s+i\s+(?:have|need)\s+to|can\s+i\s+(?:just\s+)?|is\s+it\s+(?:safe|ok|okay)\s+to)\s*(?:pay|sign|settle|plead|ignore|attend|appear|respond|reply|admit|hire|file|skip)\b/i,
  /\bwhat\s+should\s+i\s+do\b/i,
  /\b(?:what\s+are\s+my\s+chances|will\s+i\s+(?:win|lose|go\s+to\s+jail|be\s+(?:jailed|arrested|convicted)))\b/i,
  /\b(?:am\s+i\s+going\s+to\s+(?:jail|prison|lose|win))\b/i,
  /\bdapat\s+ba\s+(?:akong|kong)\s+(?:magbayad|pumirma|makipag-?areglo|dumalo|sumipot|sumagot|balewalain|umamin)\b/i,
  /\bano\s+ang\s+dapat\s+kong\s+gawin\b/i,
  /\b(?:mananalo|matatalo|makukulong)\s+ba\s+ako\b/i,
  /\bpuwede\s+ko\s+bang\s+(?:balewalain|hindi\s+pansinin)\b/i,
  /\bkailangan\s+ko\s+bang\s+(?:magbayad|pumirma|dumalo|sumipot)\b/i,
];

/** True when the user asks for legal advice or an outcome prediction (Req 15.3). */
export const isAdviceRequest = (question: string): boolean =>
  ADVICE_REQUEST.some((rule) => rule.test(question));

export const declineText = (language: Language) => ADVICE_DECLINED[language];
export const withheldText = (language: Language) =>
  GUARDRAIL_WITHHELD[language];
