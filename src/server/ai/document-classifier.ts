import {
  MIN_CLASSIFICATION_CONFIDENCE,
  NOTICE_TYPES,
  type Classification,
  type NoticeType,
  type RawClassification,
  type UncertaintyNote,
} from "../../lib/ai-types";
import { locateQuote } from "./source-checker";

/**
 * Turns a raw model classification into a trusted one. The model never gets
 * the last word: low confidence, an unknown type, or a quote that is not in
 * the document all resolve to "unrecognized" instead of a forced guess.
 */

export const isNoticeType = (value: unknown): value is NoticeType =>
  typeof value === "string" &&
  (NOTICE_TYPES as readonly string[]).includes(value);

/** Any input to an integer 0-100. Non-numeric or non-finite becomes 0. */
export function normalizeConfidence(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  // Models often answer 0-1. Treat values in (0, 1] as a fraction.
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.min(100, Math.max(0, Math.round(scaled)));
}

const unrecognized = (
  reason: string,
  confidence: number,
  notes: UncertaintyNote[],
): Classification => ({
  type: "unrecognized",
  confidence,
  source: "model",
  evidence: null,
  reason,
  notes,
});

export function resolveClassification(
  raw: RawClassification | null,
  reviewedText: string,
  userOverride?: NoticeType,
): Classification {
  if (userOverride && isNoticeType(userOverride))
    return {
      type: userOverride,
      confidence: 100,
      source: "user",
      evidence: null,
      reason: "",
      notes: [{ code: "user_override" }],
    };
  if (!raw) return unrecognized("", 0, [{ code: "invalid_type" }]);

  const confidence = normalizeConfidence(raw.confidence);
  if (!isNoticeType(raw.type))
    return unrecognized("", confidence, [{ code: "invalid_type" }]);
  if (raw.type === "unrecognized")
    return unrecognized(raw.reason, confidence, []);
  if (confidence < MIN_CLASSIFICATION_CONFIDENCE)
    return unrecognized(raw.reason, confidence, [{ code: "low_confidence" }]);

  const evidence = locateQuote(reviewedText, raw.quote);
  if (!evidence)
    return unrecognized(raw.reason, confidence, [
      { code: "unsupported_classification" },
    ]);
  return {
    type: raw.type,
    confidence,
    source: "model",
    evidence,
    reason: raw.reason,
    notes: [],
  };
}
