import type {
  ClaimBasis,
  ClaimKind,
  DeadlineKind,
  RawClaim,
  RawClassification,
  RawDate,
  RawSender,
} from "../../lib/ai-types";

/**
 * Parsers for model output. The model's JSON is untrusted: every value is
 * type-checked, malformed items are dropped, and nothing is repaired by
 * guessing. Strictness defaults favor requiring evidence (basis "document").
 */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

const CLAIM_KINDS: readonly ClaimKind[] = [
  "date",
  "amount",
  "party",
  "action",
  "consequence",
  "other",
];
const DEADLINE_KINDS: readonly DeadlineKind[] = [
  "deadline",
  "appearance",
  "hearing",
  "other",
];

/**
 * Extracts a JSON object from model text. Accepts bare JSON or one fenced
 * block. Returns null on anything else; it never repairs broken JSON.
 */
export function parseJsonObject(raw: string): Rec | null {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(raw);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    const value: unknown = JSON.parse(candidate);
    return isRec(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseRawClaims(value: unknown): RawClaim[] {
  if (!Array.isArray(value)) return [];
  const claims: RawClaim[] = [];
  for (const item of value) {
    if (!isRec(item)) continue;
    const text = str(item.text);
    if (!text) continue;
    claims.push({
      text,
      kind: CLAIM_KINDS.includes(item.kind as ClaimKind)
        ? (item.kind as ClaimKind)
        : "other",
      basis: (item.basis === "general" ? "general" : "document") as ClaimBasis,
      quote: strOrNull(item.quote),
    });
  }
  return claims;
}

export function parseRawDates(value: unknown): RawDate[] {
  if (!Array.isArray(value)) return [];
  const dates: RawDate[] = [];
  for (const item of value) {
    if (!isRec(item)) continue;
    const dateText = str(item.dateText);
    if (!dateText) continue;
    dates.push({
      kind: DEADLINE_KINDS.includes(item.kind as DeadlineKind)
        ? (item.kind as DeadlineKind)
        : "other",
      label: strOrNull(item.label) ?? "",
      dateText,
      timeText: str(item.timeText),
      quote: strOrNull(item.quote),
    });
  }
  return dates;
}

export function parseRawSender(value: unknown): RawSender | null {
  if (!isRec(value)) return null;
  const name = str(value.name);
  return name ? { name, quote: strOrNull(value.quote) } : null;
}

export function parseRawClassification(
  value: unknown,
): RawClassification | null {
  if (!isRec(value)) return null;
  const type = str(value.type);
  if (!type) return null;
  return {
    type,
    confidence: value.confidence,
    quote: strOrNull(value.quote),
    reason: strOrNull(value.reason) ?? "",
  };
}

export function parseStringList(value: unknown, max = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}
