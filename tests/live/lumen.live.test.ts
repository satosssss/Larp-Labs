/**
 * LIVE tests against the real Lumen sandbox gateway. Opt-in only:
 *
 *   RUN_LIVE_LUMEN=1 npx vitest run tests/live
 *
 * They need a local .env.local (or .env) with LUMEN_API_KEY,
 * LUMEN_API_SECRET and
 * LUMEN_API_ORIGIN. Each run spends roughly 30 API credits, uploads a fictional
 * notice and creates chat sessions that Lumen retains. They are skipped by
 * default, so normal test runs never touch the network or spend credits.
 *
 * Model output is not deterministic, so these assert structural guarantees
 * (grounding, labels, safety) rather than exact wording.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toFrontendAnalysis, toFrontendChat } from "../../src/lib/ai-mapper";
import { NOT_STATED } from "../../src/lib/ai-text";
import { exactSource } from "../../src/lib/flow";
import { analyzeDocument } from "../../src/server/ai/analyze";
import { answerQuestion } from "../../src/server/ai/chat";
import { readLumenConfig } from "../../src/server/ai/config";
import { AiError } from "../../src/server/ai/errors";
import { evaluateAll } from "../../src/server/ai/guardrail";
import { createLumenClient } from "../../src/server/ai/lumen-client";
import { extractText } from "../../src/server/ai/lumen-ocr";

const enabled = process.env.RUN_LIVE_LUMEN === "1";

/**
 * Minimal .env reader so no extra dependency is needed. Values are never
 * printed. Reads `.env.local` (what `next dev` uses) over `.env`, so the
 * credentials live in exactly one gitignored file.
 */
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of [".env", ".env.local"]) {
    let raw: string;
    try {
      raw = readFileSync(join(process.cwd(), name), "utf8");
    } catch {
      continue; // optional file
    }
    for (const line of raw.split("\n")) {
      const at = line.indexOf("=");
      if (at > 0) env[line.slice(0, at)] = line.slice(at + 1);
    }
  }
  return env;
}

describe.skipIf(!enabled)("live Lumen (real API, spends credits)", () => {
  const client = () => createLumenClient(readLumenConfig(loadEnv()));
  const png = new Uint8Array(
    readFileSync(join(process.cwd(), "tests/fixtures/fictional-notice.png")),
  );
  // Shared across tests so we only pay for one OCR read.
  let text = "";

  it("OCR reads a fictional notice image", async () => {
    const result = await extractText(client(), png);
    expect(result.provenance).toBe("lumen");
    expect(result.failedPages).toBeUndefined();
    expect(result.text).toMatch(/BARANGAY/);
    expect(result.text).toMatch(/Nobyembre\s+2026/);
    text = result.text;
  }, 90_000);

  it("analysis is grounded, labeled lumen, and passes the guardrail", async () => {
    expect(text).not.toBe("");
    const result = await analyzeDocument(client(), { text, language: "fil" });
    expect(result.provenance).toBe("lumen");
    expect(result.summary.length).toBeGreaterThan(10);

    // Every piece of evidence is an exact slice of the OCR text.
    const evidence = [
      ...result.dates.map((d) => d.evidence),
      ...(result.sender?.evidence ? [result.sender.evidence] : []),
      ...(result.classification.evidence
        ? [result.classification.evidence]
        : []),
      ...result.importantPoints.flatMap((p) =>
        p.evidence ? [p.evidence] : [],
      ),
    ];
    expect(evidence.length).toBeGreaterThan(0);
    for (const e of evidence) expect(text.slice(e.start, e.end)).toBe(e.quote);

    // The stated appearance date, sender and type are found and supported.
    expect(result.dates.length).toBeGreaterThan(0);
    expect(result.dates[0].dateText).toMatch(/Nobyembre\s+2026/);
    expect(result.sender?.name).toMatch(/Barangay Halimbawa/);
    expect(result.classification.type).toBe("barangay_notice");
    expect(result.classification.evidence).not.toBeNull();

    expect(
      evaluateAll([
        result.summary,
        ...result.nextSteps,
        ...result.importantPoints.map((p) => p.text),
      ]).ok,
    ).toBe(true);

    // The frontend view model accepts it with its own source check.
    const view = toFrontendAnalysis(result);
    expect(view).not.toBeNull();
    expect(exactSource(text, view!.quote)).toBeGreaterThanOrEqual(0);
    expect(view!.summary).not.toContain("MOCK");
  }, 90_000);

  it("a question about the document is answered with a verified source", async () => {
    const result = await answerQuestion(client(), {
      text,
      question: "Kailan ang pag-uusap?",
      language: "fil",
    });
    expect(result.provenance).toBe("lumen");
    expect(result.answeredFromDocument).toBe(true);
    const reply = toFrontendChat(result);
    expect(exactSource(text, reply.quote!)).toBeGreaterThanOrEqual(0);
  }, 90_000);

  it("a question the document cannot answer is never answered with an invented source", async () => {
    // Observed on the real service: either the model answers "not stated", or
    // the instance's own scope check declines in plain prose (out_of_scope).
    // Both are honest outcomes; fabricating an answer or source is not.
    try {
      const result = await answerQuestion(client(), {
        text,
        question: "Magkano ang multa kapag hindi ako sumipot?",
        language: "fil",
      });
      const reply = toFrontendChat(result);
      expect(result.answer).toContain(NOT_STATED.fil);
      expect(reply.quote).toBeUndefined();
    } catch (error) {
      expect(error).toBeInstanceOf(AiError);
      expect((error as AiError).code).toBe("out_of_scope");
    }
  }, 90_000);
});
