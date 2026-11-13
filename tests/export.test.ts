import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createReport } from "../src/lib/report";
import { safeShareUrl } from "../src/lib/gateway";
import { sampleAnalysis } from "../src/lib/sample";
afterEach(() => vi.unstubAllGlobals());
it("only accepts same-origin share paths and allows HTTP on loopback", () => {
  expect(safeShareUrl("/s/abc", "https://legalinaw.test")).toBe(
    "https://legalinaw.test/s/abc",
  );
  expect(
    safeShareUrl("http://127.0.0.1:3003/s/abc", "http://127.0.0.1:3003"),
  ).toBe("http://127.0.0.1:3003/s/abc");
  expect(
    safeShareUrl("https://legalinaw.test/s/abc", "https://legalinaw.test"),
  ).toBe("https://legalinaw.test/s/abc");
  for (const url of [
    "javascript:alert(1)",
    "https://evil.test/s/abc",
    "https://legalinaw.test/not-share",
    "https://user@legalinaw.test/s/abc",
    "https://legalinaw.test/s/abc?redirect=evil",
  ])
    expect(safeShareUrl(url, "https://legalinaw.test")).toBeNull();
  expect(
    safeShareUrl("http://legalinaw.test/s/abc", "http://legalinaw.test"),
  ).toBeNull();
});
it("creates a readable multipage PDF with long questions and accented text", async () => {
  const font = await readFile("public/fonts/Geist-Regular.ttf");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(font)),
  );
  const blob = await createReport({
    analysis: sampleAnalysis("fil"),
    sample: true,
    language: "fil",
    checked: ["notice"],
    questions: Array.from(
      { length: 20 },
      (_, i) => `${i} Peña — ${"LongQuestion".repeat(25)}`,
    ),
  });
  expect(blob.type).toBe("application/pdf");
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  expect(doc.getPageCount()).toBeGreaterThan(1);
  expect(doc.getTitle()).toContain("LegaLinaw");
});
it("fails clearly when no analysis is available", async () => {
  await expect(
    createReport({
      analysis: null,
      language: "en",
      checked: [],
      questions: [],
    }),
  ).rejects.toThrow("No analysis");
});
