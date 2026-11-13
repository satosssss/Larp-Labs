import type { Language } from "./sample";

/**
 * Shared AI result types. Pure types, safe to import from browser or server.
 * The frontend view model (`Analysis` in ./sample) is intentionally smaller;
 * see ./ai-mapper for the adapter. Changing these types is a shared-contract
 * change and needs coordination with the frontend and backend owners.
 */

export const NOTICE_TYPES = [
  "subpoena",
  "court_notice",
  "barangay_notice",
  "demand_letter",
  "lending_app_collection",
  "government_agency",
  "legal_agreement",
  "unrecognized",
] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

/** Minimum confidence (0-100) for a model-assigned type to be kept. Req 6.4. */
export const MIN_CLASSIFICATION_CONFIDENCE = 60;

/**
 * Where an AI result came from. Mock output must never look like real output.
 * OCR text comes from Lumen; analysis and chat answers come from Gemini.
 */
export type Provenance = "mock" | "lumen" | "gemini";

/** A passage that is an exact, character-for-character slice of the reviewed text. */
export type Evidence = { quote: string; start: number; end: number };

export type ClaimKind =
  "date" | "amount" | "party" | "action" | "consequence" | "other";
/** `document`: the model says the document states it. `general`: background info. */
export type ClaimBasis = "document" | "general";

/** A claim as proposed by the model, before the Source Checker has looked at it. */
export type RawClaim = {
  text: string;
  kind: ClaimKind;
  basis: ClaimBasis;
  quote: string | null;
};

/**
 * supported: basis "document" and the quote was verified against the text.
 * not_stated: basis "document" but no verifiable quote. Shown with the
 *   "not stated in the document" label and no source reference.
 * general: general information, never presented as a statement of the document.
 */
export type ClaimStatus = "supported" | "not_stated" | "general";
export type GroundedClaim = {
  text: string;
  kind: ClaimKind;
  status: ClaimStatus;
  evidence: Evidence | null;
};

export type UncertaintyCode =
  | "low_confidence"
  | "unsupported_classification"
  | "invalid_type"
  | "user_override"
  | "unsupported_claims_removed"
  | "unsupported_dates_removed"
  | "no_dates_found";
export type UncertaintyNote = { code: UncertaintyCode };

export type Classification = {
  type: NoticeType;
  /** Integer 0-100. 100 when the user chose the type. */
  confidence: number;
  source: "model" | "user";
  /** Passage supporting the type. Null when none could be verified. */
  evidence: Evidence | null;
  reason: string;
  notes: UncertaintyNote[];
};

export type DeadlineKind = "deadline" | "appearance" | "hearing" | "other";
/** Dates are kept as written in the document. Parsing and ambiguity rules are
 * a separate, still-open decision (design OD8). */
export type RawDate = {
  kind: DeadlineKind;
  label: string;
  dateText: string;
  timeText: string | null;
  quote: string | null;
};
export type DeadlineItem = {
  kind: DeadlineKind;
  label: string;
  dateText: string;
  timeText: string | null;
  evidence: Evidence;
};

export type SenderInfo = { name: string; evidence: Evidence | null };
export type RawSender = { name: string; quote: string | null };

export type RawClassification = {
  type: string;
  confidence: unknown;
  quote: string | null;
  reason: string;
};

export type AiAnalysisResult = {
  language: Language;
  provenance: Provenance;
  classification: Classification;
  summary: string;
  importantPoints: GroundedClaim[];
  sender: SenderInfo | null;
  dates: DeadlineItem[];
  /** General preparation steps. Never directives such as pay, sign or settle. */
  nextSteps: string[];
  uncertaintyNotes: UncertaintyNote[];
  disclaimer: string;
};

export type AiChatResult = {
  language: Language;
  provenance: Provenance;
  answer: string;
  claims: GroundedClaim[];
  /** False when the question could not be answered from the document. */
  answeredFromDocument: boolean;
  /** True when the assistant declined to give advice or predict an outcome. */
  declined: boolean;
  disclaimer: string;
};

/** Neutral internal message shape. Not Lumen's wire format, which is unknown. */
export type PromptMessage = { role: "system" | "user"; content: string };
/** `analyze` covers classification, dates, key info and the explanation in one call. */
export type PromptTask = "analyze" | "qa";
export type Prompt = {
  task: PromptTask;
  language: Language;
  messages: PromptMessage[];
};
