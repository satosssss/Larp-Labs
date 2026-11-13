import type { NoticeType, Prompt, Provenance } from "../../lib/ai-types";
import { NOTICE_TYPE_LABEL, NOT_STATED } from "../../lib/ai-text";
import type { Language } from "../../lib/sample";
import { AiError } from "./errors";
import { isAdviceRequest } from "./guardrail";
import { LUMEN_MESSAGE_MAX_CHARS } from "./limits";
import type {
  ChatInput,
  ChatOutput,
  LumenClient,
  OcrInput,
  OcrOutput,
} from "./lumen-client";

/**
 * MOCK Lumen client for development and tests. It is NOT Lumen.
 *
 * - OCR does not read the uploaded file. It returns a fixed fictional notice,
 *   starting with a visible marker line, so nobody mistakes it for a real
 *   extraction.
 * - "Chat" is a deterministic rule-based stand-in. It returns JSON in the same
 *   shapes the prompts ask a real model for, derived from the actual document
 *   text, so the parse/validate/ground pipeline is exercised identically.
 * Results built from it carry provenance "mock" and are marked in the UI text.
 */

export const MOCK_OCR_MARK =
  "[MOCK OCR - fictional sample text. Your file was NOT read.]";

export const MOCK_OCR_BODY = `BARANGAY HALIMBAWA
PAANYAYA SA PAG-UUSAP

Para kay: Pangalan Halimbawa

Inaanyayahan kayong dumalo sa isang pag-uusap sa tanggapan ng barangay sa ika-20 ng Nobyembre 2026, alas-9:00 ng umaga, tungkol sa isang usapin sa inyong kapitbahay.

Mangyaring dalhin ang liham na ito.

Mula sa: Tanggapan ng Barangay Halimbawa`;

export type MockOptions = {
  /** Replace the fictional OCR text (for tests). */
  ocrText?: string;
  /** Simulate an OCR failure. */
  ocrFailure?: "error" | "timeout";
  /** Replace the model's raw reply, to test malformed or hostile output. */
  chatOverride?: (prompt: Prompt) => string | Promise<string>;
};

const MONTHS =
  "Enero|Pebrero|Marso|Abril|Mayo|Hunyo|Hulyo|Agosto|Setyembre|Oktubre|Nobyembre|Disyembre|January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_FIL = new RegExp(
  String.raw`(?:ika-)?\d{1,2}(?:\s*ng\s+|\s+)(?:${MONTHS})\s+\d{4}`,
  "gi",
);
const DATE_EN = new RegExp(String.raw`(?:${MONTHS})\s+\d{1,2},?\s+\d{4}`, "gi");
const TIME_FIL =
  /alas-?\s?\d{1,2}(?::\d{2})?\s*ng\s*(?:umaga|hapon|gabi|tanghali)/i;
const TIME_EN = /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/i;

/** The sentence or line around [index, index+length), as an exact slice. */
function around(text: string, index: number, length: number): string {
  let start = index;
  while (start > 0) {
    if (text[start - 1] === "\n") break;
    if (
      start > 1 &&
      /[.!?]/.test(text[start - 2]) &&
      /\s/.test(text[start - 1])
    )
      break;
    start -= 1;
  }
  let end = index + length;
  while (end < text.length) {
    const c = text[end];
    if (c === "\n") break;
    if (
      /[.!?]/.test(c) &&
      (end + 1 >= text.length || /\s/.test(text[end + 1]))
    ) {
      end += 1;
      break;
    }
    end += 1;
  }
  return text.slice(start, end);
}

type MockDate = {
  kind: string;
  label: string;
  dateText: string;
  timeText: string | null;
  quote: string;
};

function findDates(text: string): MockDate[] {
  const hits: { index: number; value: string }[] = [];
  for (const re of [DATE_FIL, DATE_EN])
    for (const m of text.matchAll(re))
      hits.push({ index: m.index, value: m[0] });
  hits.sort((a, b) => a.index - b.index);
  const out: MockDate[] = [];
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.index < lastEnd) continue;
    lastEnd = hit.index + hit.value.length;
    const quote = around(text, hit.index, hit.value.length);
    const lower = quote.toLowerCase();
    const kind =
      /dumalo|appear|hearing|pagdinig|sumipot|meeting|pag-uusap/.test(lower)
        ? "appearance"
        : /on or before|bago|hanggang|deadline|due/.test(lower)
          ? "deadline"
          : "other";
    const time = TIME_FIL.exec(quote) ?? TIME_EN.exec(quote);
    out.push({
      kind,
      label: kind,
      dateText: hit.value,
      timeText: time ? time[0] : null,
      quote,
    });
  }
  return out.slice(0, 5);
}

const TYPE_RULES: [NoticeType, RegExp][] = [
  ["subpoena", /subpoena/i],
  ["lending_app_collection", /lending|quickpera|collections?\b|ipapakalat/i],
  ["demand_letter", /demand letter|demands? payment|paniningil/i],
  ["barangay_notice", /barangay/i],
  ["court_notice", /\bcourt\b|korte|summons|hukuman/i],
  ["legal_agreement", /agreement|kasunduan/i],
  [
    "government_agency",
    /republic of the philippines|kagawaran|department of|bureau/i,
  ],
];

function classify(text: string): {
  type: NoticeType;
  confidence: number;
  quote: string | null;
} {
  for (const [type, re] of TYPE_RULES) {
    const m = re.exec(text);
    if (m) {
      const quote = around(text, m.index, m[0].length);
      if (quote.trim().length >= 6) return { type, confidence: 85, quote };
    }
  }
  return { type: "unrecognized", confidence: 30, quote: null };
}

function findSender(text: string): { name: string; quote: string } | null {
  const m = /^(?:Mula sa|From)\s*:\s*(.+)$/im.exec(text);
  return m ? { name: m[1].trim(), quote: m[0] } : null;
}

const NEXT_STEPS: Record<Language, string[]> = {
  fil: [
    "Basahin muli ang notice at isulat ang mga petsang nakasaad.",
    "Ihanda ang mga dokumentong binanggit sa notice.",
    "Kung hindi ka sigurado, humingi ng libreng tulong sa Public Attorney's Office (PAO).",
  ],
  en: [
    "Read the notice again and write down the dates it states.",
    "Gather the documents the notice mentions.",
    "If you are unsure, ask the Public Attorney's Office (PAO) for free help.",
  ],
};

function documentOf(prompt: Prompt): string {
  const user = prompt.messages.find((m) => m.role === "user")?.content ?? "";
  const m = /<document>\n([\s\S]*?)\n<\/document>/.exec(user);
  return m ? m[1] : "";
}
function questionOf(prompt: Prompt): string {
  const user = prompt.messages.find((m) => m.role === "user")?.content ?? "";
  const i = user.indexOf("\n\nQuestion:\n");
  return i < 0 ? "" : user.slice(i + "\n\nQuestion:\n".length);
}

/** The combined analysis reply, in the exact shape the analyze prompt asks for. */
function analysis(text: string, language: Language): unknown {
  const cls = classify(text);
  const dates = findDates(text);
  const sender = findSender(text);
  const label = NOTICE_TYPE_LABEL[cls.type][language];
  const first = dates[0];
  const summary =
    language === "fil"
      ? `${cls.type === "unrecognized" ? "Hindi matukoy ang uri ng dokumentong ito." : `Ito ay ${label.toLowerCase()}.`} ${sender ? `Mula ito sa ${sender.name}. ` : ""}${first ? `May nakasaad na petsa: ${first.dateText}.` : "Walang petsang nakasaad sa dokumento."}`
      : `${cls.type === "unrecognized" ? "The type of this document could not be determined." : `This is a ${label.toLowerCase()}.`} ${sender ? `It is from ${sender.name}. ` : ""}${first ? `It states the date ${first.dateText}.` : "No date is stated in the document."}`;
  const importantPoints = [
    ...dates.map((d) => ({
      text:
        language === "fil"
          ? `Petsa sa dokumento: ${d.dateText}${d.timeText ? `, ${d.timeText}` : ""}.`
          : `Date in the document: ${d.dateText}${d.timeText ? `, ${d.timeText}` : ""}.`,
      kind: "date",
      basis: "document",
      quote: d.quote,
    })),
    ...(sender
      ? [
          {
            text:
              language === "fil"
                ? `Nagpadala: ${sender.name}.`
                : `Sender: ${sender.name}.`,
            kind: "party",
            basis: "document",
            quote: sender.quote,
          },
        ]
      : []),
  ];
  return {
    type: cls.type,
    confidence: cls.confidence,
    typeEvidence: cls.quote,
    summary: summary.trim(),
    sender: sender ? { name: sender.name, quote: sender.quote } : null,
    dates,
    points: importantPoints,
    nextSteps: NEXT_STEPS[language],
  };
}

function answer(prompt: Prompt): unknown {
  const text = documentOf(prompt);
  const question = questionOf(prompt);
  const language = prompt.language;
  const q = question.toLowerCase();
  const dates = findDates(text);
  const notStated = {
    answer: NOT_STATED[language],
    answeredFromDocument: false,
    declined: false,
    claims: [],
  };
  let result: {
    answer: string;
    answeredFromDocument: boolean;
    declined: boolean;
    claims: unknown[];
  } = notStated;

  if (/kailan|when|petsa|date/.test(q)) {
    const d = dates[0];
    if (d)
      result = {
        answer:
          language === "fil"
            ? `Ayon sa dokumento: ${d.dateText}${d.timeText ? `, ${d.timeText}` : ""}.`
            : `According to the document: ${d.dateText}${d.timeText ? `, ${d.timeText}` : ""}.`,
        answeredFromDocument: true,
        declined: false,
        claims: [
          { text: d.dateText, kind: "date", basis: "document", quote: d.quote },
        ],
      };
  } else if (/dalhin|dala|bring/.test(q)) {
    const m = /dalhin|bring/i.exec(text);
    if (m) {
      const quote = around(text, m.index, m[0].length);
      result = {
        answer:
          language === "fil"
            ? `Nakasaad sa dokumento: ${quote}`
            : `The document says: ${quote}`,
        answeredFromDocument: true,
        declined: false,
        claims: [{ text: quote, kind: "action", basis: "document", quote }],
      };
    }
  } else if (/\b(?:tungkol|about|ano ang|what is|what does)\b/.test(q)) {
    const cls = classify(text);
    if (cls.quote)
      result = {
        answer:
          language === "fil"
            ? `Mukhang ${NOTICE_TYPE_LABEL[cls.type][language].toLowerCase()} ito.`
            : `This looks like a ${NOTICE_TYPE_LABEL[cls.type][language].toLowerCase()}.`,
        answeredFromDocument: true,
        declined: false,
        claims: [
          {
            text: cls.quote,
            kind: "other",
            basis: "document",
            quote: cls.quote,
          },
        ],
      };
  }
  if (isAdviceRequest(question)) result = { ...result, declined: true };
  return result;
}

export class MockLumenClient implements LumenClient {
  readonly provenance: Provenance = "mock";
  /** Same cap as the live service, so mock mode behaves like the real thing. */
  readonly maxMessageChars = LUMEN_MESSAGE_MAX_CHARS;
  constructor(private readonly options: MockOptions = {}) {}

  async ocr(input: OcrInput): Promise<OcrOutput> {
    void input.bytes; // the mock never reads the file
    if (this.options.ocrFailure === "error")
      throw new AiError("upstream_error");
    if (this.options.ocrFailure === "timeout") throw new AiError("timeout");
    const text = this.options.ocrText ?? `${MOCK_OCR_MARK}\n\n${MOCK_OCR_BODY}`;
    return { text, pages: [{ page: 1, text }] };
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { prompt } = input;
    if (this.options.chatOverride)
      return { text: await this.options.chatOverride(prompt) };
    const text = documentOf(prompt);
    switch (prompt.task) {
      case "analyze":
        return { text: JSON.stringify(analysis(text, prompt.language)) };
      case "qa":
        return { text: JSON.stringify(answer(prompt)) };
    }
  }
}
