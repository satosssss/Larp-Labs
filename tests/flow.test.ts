import { safeExternalUrl } from "../src/lib/gateway";
import { describe, expect, it } from "vitest";
import { createFlowStore, exactSource, validReview } from "../src/lib/flow";
import { SAMPLE_TEXT, sampleAnalysis } from "../src/lib/sample";

describe("review and document boundaries", () => {
  it("does not permit explanation before reviewed text is confirmed", () => {
    const s = createFlowStore();
    s.getState().startSample();
    expect(s.getState().go(2)).toBe(false);
    expect(s.getState().confirm()).toBe(true);
    expect(s.getState().go(2)).toBe(true);
  });
  it("rejects blank and oversized reviewed text", () => {
    expect(validReview("  ")).toBe(false);
    expect(validReview("x".repeat(100001))).toBe(false);
    expect(validReview("Isang paunawa.")).toBe(true);
  });
  it("invalidates downstream content when the user edits source text", () => {
    const s = createFlowStore();
    s.getState().startSample();
    s.getState().confirm();
    s.getState().setText("A different notice");
    expect(s.getState().analysis).toBeNull();
    expect(s.getState().confirmed).toBe(false);
    expect(s.getState().messages).toEqual([]);
    expect(s.getState().confirm()).toBe(false);
  });
  it("clears sample outputs when a real document is selected", () => {
    const s = createFlowStore();
    s.getState().startSample();
    s.getState().confirm();
    s.getState().startReal();
    expect(s.getState().mode).toBe("real");
    expect(s.getState().text).toBe("");
    expect(s.getState().analysis).toBeNull();
    expect(s.getState().go(2)).toBe(false);
  });
  it("ignores results for an older document revision", () => {
    const s = createFlowStore();
    s.getState().startSample();
    const revision = s.getState().revision;
    s.getState().startReal();
    expect(s.getState().acceptAnalysis(revision, sampleAnalysis("fil"))).toBe(
      false,
    );
    expect(s.getState().analysis).toBeNull();
  });
  it("requires both follow-ups to be answered or skipped before preparation", () => {
    const s = createFlowStore();
    s.getState().startSample();
    s.getState().confirm();
    expect(s.getState().go(4)).toBe(false);
    s.getState().answer(0, "skip");
    s.getState().answer(1, "skip");
    expect(s.getState().go(4)).toBe(true);
  });
  it("preserves edited questions and checkmarks when language changes", () => {
    const s = createFlowStore();
    s.getState().startSample();
    s.getState().confirm();
    s.getState().setQuestions(["My own question"]);
    s.getState().toggleCheck("notice");
    s.getState().setLanguage("en");
    expect(s.getState().questions).toEqual(["My own question"]);
    expect(s.getState().checked).toEqual(["notice"]);
    expect(s.getState().analysis?.language).toBe("en");
  });
  it("only returns an exact source passage", () => {
    expect(
      exactSource(SAMPLE_TEXT, "Mangyaring dalhin ang liham na ito."),
    ).toBeGreaterThan(-1);
    expect(exactSource(SAMPLE_TEXT, "You must pay immediately.")).toBe(-1);
    expect(exactSource(SAMPLE_TEXT, "")).toBe(-1);
  });
});

describe("real-document review boundaries", () => {
  it("does not populate real documents with fictional preparation questions", () => {
    const s = createFlowStore();
    s.getState().startReal();
    s.getState().setText("A real notice for review");
    s.getState().confirm();
    expect(s.getState().questions).toEqual([]);
  });
  it("keeps the original selected document through review and clears it on restart", () => {
    const s = createFlowStore();
    const file = new File(["notice"], "notice.pdf", {
      type: "application/pdf",
    });
    s.getState().startReal(file);
    s.getState().setText("A real notice for review");
    expect(s.getState().document).toBe(file);
    s.getState().startReal();
    expect(s.getState().document).toBeNull();
  });
});

it("does not restore deliberately removed preparation questions", () => {
  const s = createFlowStore();
  s.getState().startSample();
  s.getState().confirm();
  s.getState().setQuestions([]);
  s.getState().go(1);
  s.getState().confirm();
  expect(s.getState().questions).toEqual([]);
});
it("rejects unsafe share and provider URLs", () => {
  expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
  expect(safeExternalUrl("https://example.com/s/123")).toBe(
    "https://example.com/s/123",
  );
});
