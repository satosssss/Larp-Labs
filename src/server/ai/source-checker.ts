import type {
  ClaimKind,
  DeadlineItem,
  Evidence,
  GroundedClaim,
  RawClaim,
  RawDate,
  RawSender,
  SenderInfo,
} from "../../lib/ai-types";

/**
 * Source Checker. Pure functions, no I/O.
 * The model proposes quotes; this code decides. A quote is accepted only when
 * it matches the reviewed text, and the Evidence returned is ALWAYS the
 * original, character-for-character slice of that text, so the frontend can
 * highlight exactly the range it receives.
 *
 * The one tolerance: differences in whitespace are ignored when matching. OCR
 * output is hard-wrapped, and models naturally join "...Nobyembre 2026,\nalas-9"
 * into one line with a space. Everything else (letters, digits, punctuation,
 * capitalization) must match exactly, so nothing can be invented.
 */

/** Quotes shorter than this carry no real evidence and match almost anything. */
export const MIN_QUOTE_CHARS = 6;
export const MAX_DATES = 5;

/** Kinds that can only ever be statements of the document, never "general". */
const FACTUAL_KINDS: ReadonlySet<ClaimKind> = new Set([
  "date",
  "amount",
  "party",
]);

/** Collapses every whitespace run to one space and trims the ends. */
export const squash = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

/**
 * Collapses whitespace runs in `text` and remembers where each kept character
 * came from, so a match can be mapped back to the original slice.
 */
function collapseWithMap(text: string): { norm: string; origin: number[] } {
  let norm = "";
  const origin: number[] = [];
  let previousWasSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    if (/\s/.test(text[i])) {
      if (!previousWasSpace) {
        norm += " ";
        origin.push(i);
      }
      previousWasSpace = true;
    } else {
      norm += text[i];
      origin.push(i);
      previousWasSpace = false;
    }
  }
  return { norm, origin };
}

export function locateQuote(text: string, quote: unknown): Evidence | null {
  if (typeof quote !== "string") return null;
  if (quote.trim().length < MIN_QUOTE_CHARS) return null;
  const exact = text.indexOf(quote);
  if (exact >= 0) return { quote, start: exact, end: exact + quote.length };

  // Whitespace-tolerant fallback; the result is still an exact original slice.
  const needle = squash(quote);
  const { norm, origin } = collapseWithMap(text);
  const at = norm.indexOf(needle);
  if (at < 0) return null;
  const start = origin[at];
  const end = origin[at + needle.length - 1] + 1;
  return { quote: text.slice(start, end), start, end };
}

/** True when `part` appears in `whole`, ignoring whitespace differences. */
const containsLoose = (whole: string, part: string): boolean =>
  squash(whole).includes(squash(part));

/** Longest passage we will build as evidence ourselves. */
const MAX_BUILT_EVIDENCE_CHARS = 400;

const lineStartOf = (text: string, i: number) =>
  i <= 0 ? 0 : text.lastIndexOf("\n", i - 1) + 1;
const lineEndOf = (text: string, i: number) => {
  const newline = text.indexOf("\n", i);
  return newline < 0 ? text.length : newline;
};
/** A line that starts with a capital letter (after any opening quote) opens a sentence. */
const opensSentence = (text: string, lineStart: number) =>
  /^[ \t]*["“'(\[]?\p{Lu}/u.test(text.slice(lineStart, lineStart + 12));
const closesSentence = (line: string) => /[.!?]["”')\]]?\s*$/.test(line);

/**
 * Widens a located span to the sentence around it in hard-wrapped OCR text.
 * Backward: keep taking earlier lines until one starts with a capital letter
 * (so headings above a paragraph are not swallowed). Forward: keep taking
 * lines until one ends the sentence or the next line opens a new one.
 */
function sentenceEvidence(text: string, span: Evidence): Evidence {
  let start = lineStartOf(text, span.start);
  for (let i = 0; i < 4 && start > 0 && !opensSentence(text, start); i += 1)
    start = lineStartOf(text, start - 1);

  let end = lineEndOf(text, span.end);
  for (
    let i = 0;
    i < 4 &&
    end < text.length &&
    !closesSentence(text.slice(lineStartOf(text, end), end)) &&
    !opensSentence(text, end + 1);
    i += 1
  )
    end = lineEndOf(text, end + 1);

  return end - start > MAX_BUILT_EVIDENCE_CHARS
    ? span
    : { quote: text.slice(start, end), start, end };
}

/** Widens a located span to the whole line(s) it touches. */
function lineEvidence(text: string, span: Evidence): Evidence {
  const start =
    span.start === 0 ? 0 : text.lastIndexOf("\n", span.start - 1) + 1;
  const newline = text.indexOf("\n", span.end);
  const end = newline < 0 ? text.length : newline;
  return end - start > MAX_BUILT_EVIDENCE_CHARS
    ? span
    : { quote: text.slice(start, end), start, end };
}

/** True when the evidence still points at identical text in `text`. */
export function isStillValid(text: string, evidence: Evidence): boolean {
  return (
    evidence.start >= 0 &&
    evidence.end <= text.length &&
    text.slice(evidence.start, evidence.end) === evidence.quote
  );
}

export function groundClaim(text: string, raw: RawClaim): GroundedClaim {
  if (raw.basis === "general" && !FACTUAL_KINDS.has(raw.kind))
    return {
      text: raw.text,
      kind: raw.kind,
      status: "general",
      evidence: null,
    };
  const evidence = locateQuote(text, raw.quote);
  if (!evidence)
    return {
      text: raw.text,
      kind: raw.kind,
      status: "not_stated",
      evidence: null,
    };
  return { text: raw.text, kind: raw.kind, status: "supported", evidence };
}

export function groundClaims(text: string, raw: RawClaim[]): GroundedClaim[] {
  return raw.map((claim) => groundClaim(text, claim));
}

export const hasUnsupported = (claims: GroundedClaim[]) =>
  claims.some((c) => c.status === "not_stated");

export function groundSender(
  text: string,
  raw: RawSender | null,
): SenderInfo | null {
  if (!raw || !raw.name.trim()) return null;
  const quoted = locateQuote(text, raw.quote);
  // The sender name must appear inside its own supporting passage.
  if (quoted && containsLoose(quoted.quote, raw.name))
    return { name: raw.name, evidence: quoted };
  // The model's quote did not verify, but the name itself may still be in the
  // document. Code, not the model, then builds the evidence from the real text.
  const named = locateQuote(text, raw.name);
  return named ? { name: raw.name, evidence: lineEvidence(text, named) } : null;
}

/**
 * Keeps only dates that are really in the document. The date text (and time, if
 * given) must appear in the document, either inside the model's quote or, when
 * that quote does not verify, at a location the code finds itself. Nothing is
 * inferred or computed, for example "within 5 days of receipt".
 */
export function groundDates(
  text: string,
  raw: RawDate[],
): { dates: DeadlineItem[]; rejected: number } {
  const dates: DeadlineItem[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (const item of raw) {
    if (!item.dateText.trim()) {
      rejected += 1;
      continue;
    }
    let evidence = locateQuote(text, item.quote);
    if (!evidence || !containsLoose(evidence.quote, item.dateText)) {
      // The quote failed, but the date text itself may be in the document.
      const found = locateQuote(text, item.dateText);
      evidence = found ? sentenceEvidence(text, found) : null;
    }
    if (!evidence) {
      rejected += 1;
      continue;
    }
    const key = `${evidence.start}:${squash(item.dateText)}`;
    if (seen.has(key)) continue; // the model listed the same date twice
    seen.add(key);
    // An unverifiable time is dropped; the date itself stays.
    const timeText =
      item.timeText && containsLoose(evidence.quote, item.timeText)
        ? item.timeText
        : null;
    dates.push({
      kind: item.kind,
      label: item.label,
      dateText: item.dateText,
      timeText,
      evidence,
    });
  }
  return { dates: dates.slice(0, MAX_DATES), rejected };
}

/** After the user edits the text, flags evidence that no longer matches. */
export function markOutdated(
  evidences: Evidence[],
  newText: string,
): { evidence: Evidence; outdated: boolean }[] {
  return evidences.map((evidence) => ({
    evidence,
    outdated: !isStillValid(newText, evidence),
  }));
}
