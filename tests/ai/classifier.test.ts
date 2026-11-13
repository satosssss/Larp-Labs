import { describe, expect, it } from "vitest";
import {
  isNoticeType,
  normalizeConfidence,
  resolveClassification,
} from "../../src/server/ai/document-classifier";
import {
  parseJsonObject,
  parseRawClassification,
} from "../../src/server/ai/model-output";
import { NOTICE_TYPES, type RawClassification } from "../../src/lib/ai-types";
import { BARANGAY_FIL, UNCLEAR } from "../fixtures/notices";

const QUOTE = "PAANYAYA SA PAG-UUSAP";
const raw = (over: Partial<RawClassification>): RawClassification => ({
  type: "barangay_notice",
  confidence: 90,
  quote: QUOTE,
  reason: "Paanyaya mula sa barangay.",
  ...over,
});

describe("normalizeConfidence", () => {
  it.each([
    [90, 90],
    [90.6, 91],
    [150, 100],
    [-5, 0],
    [0.85, 85],
    [1, 100],
    ["72", 72],
    [Number.NaN, 0],
    [Infinity, 0],
    ["high", 0],
    [null, 0],
    [undefined, 0],
  ])("%s -> %s", (input, out) => expect(normalizeConfidence(input)).toBe(out));
});

describe("resolveClassification", () => {
  it("keeps a confident, evidenced type and returns the supporting passage", () => {
    const c = resolveClassification(raw({}), BARANGAY_FIL);
    expect(c.type).toBe("barangay_notice");
    expect(c.evidence?.quote).toBe(QUOTE);
    expect(c.notes).toEqual([]);
  });
  it("returns unrecognized below 60 confidence, not a forced guess", () => {
    const c = resolveClassification(raw({ confidence: 59 }), BARANGAY_FIL);
    expect(c.type).toBe("unrecognized");
    expect(c.notes).toEqual([{ code: "low_confidence" }]);
    expect(
      resolveClassification(raw({ confidence: 60 }), BARANGAY_FIL).type,
    ).toBe("barangay_notice");
  });
  it("returns unrecognized when the supporting quote is fabricated", () => {
    const c = resolveClassification(
      raw({ quote: "SUBPOENA DUCES TECUM from the Regional Trial Court" }),
      BARANGAY_FIL,
    );
    expect(c.type).toBe("unrecognized");
    expect(c.evidence).toBeNull();
    expect(c.notes).toEqual([{ code: "unsupported_classification" }]);
  });
  it("returns unrecognized for a missing quote", () => {
    expect(resolveClassification(raw({ quote: null }), BARANGAY_FIL).type).toBe(
      "unrecognized",
    );
  });
  it("returns unrecognized for a type outside the allowed list", () => {
    const c = resolveClassification(raw({ type: "tax_bill" }), BARANGAY_FIL);
    expect(c.type).toBe("unrecognized");
    expect(c.notes).toEqual([{ code: "invalid_type" }]);
  });
  it("returns unrecognized for missing model output", () => {
    expect(resolveClassification(null, BARANGAY_FIL).type).toBe("unrecognized");
  });
  it("an unclear document stays unrecognized even if the model is overconfident without evidence", () => {
    const c = resolveClassification(
      raw({
        type: "demand_letter",
        confidence: 95,
        quote: "demand for payment",
      }),
      UNCLEAR,
    );
    expect(c.type).toBe("unrecognized");
  });
  it("a model 'unrecognized' answer passes through", () => {
    const c = resolveClassification(
      raw({ type: "unrecognized", confidence: 30, quote: null }),
      UNCLEAR,
    );
    expect(c.type).toBe("unrecognized");
    expect(c.notes).toEqual([]);
  });
  it("the user's choice always wins and is marked as the user's", () => {
    const c = resolveClassification(null, UNCLEAR, "demand_letter");
    expect(c.type).toBe("demand_letter");
    expect(c.source).toBe("user");
    expect(c.confidence).toBe(100);
  });
  it("every allowed type is recognized", () => {
    for (const t of NOTICE_TYPES) expect(isNoticeType(t)).toBe(true);
    expect(isNoticeType("lawyer")).toBe(false);
  });
});

describe("model output parsing", () => {
  it("parses bare and fenced JSON, and refuses anything else", () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Here you go: {"a":1}')).toBeNull();
    expect(parseJsonObject("{broken")).toBeNull();
    expect(parseJsonObject("[1,2]")).toBeNull();
    expect(parseJsonObject("")).toBeNull();
  });
  it("rejects malformed classification objects", () => {
    expect(parseRawClassification(null)).toBeNull();
    expect(parseRawClassification({})).toBeNull();
    expect(parseRawClassification({ type: 5 })).toBeNull();
    expect(
      parseRawClassification({ type: "subpoena", confidence: 80 }),
    ).toEqual({
      type: "subpoena",
      confidence: 80,
      quote: null,
      reason: "",
    });
  });
});
