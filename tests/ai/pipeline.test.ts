import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeDocument } from "../../src/server/ai/analyze";
import { answerQuestion } from "../../src/server/ai/chat";
import { extractText } from "../../src/server/ai/lumen-ocr";
import {
  MOCK_OCR_BODY,
  MOCK_OCR_MARK,
  MockLumenClient,
} from "../../src/server/ai/lumen-mock";
import { markOutdated } from "../../src/server/ai/source-checker";
import { toFrontendAnalysis, toFrontendChat } from "../../src/lib/ai-mapper";
import { NOT_STATED } from "../../src/lib/ai-text";
import { exactSource } from "../../src/lib/flow";
import {
  BARANGAY_FIL,
  DEMAND_EN,
  INJECTION,
  UNCLEAR,
} from "../fixtures/notices";
import { JPEG, PNG, expectAiError, pdf, textFile } from "./helpers";

const mock = () => new MockLumenClient();

describe("mock OCR extraction (NOT real Lumen)", () => {
  it("returns clearly marked fictional text and identifies itself as mock", async () => {
    const r = await extractText(mock(), PNG);
    expect(r.provenance).toBe("mock");
    expect(r.text.startsWith(MOCK_OCR_MARK)).toBe(true);
    expect(r.pages?.[0].page).toBe(1);
  });
  it("never reads the uploaded file: different files give identical output", async () => {
    const a = await extractText(mock(), PNG);
    const b = await extractText(mock(), pdf(2));
    expect(a.text).toBe(b.text);
  });
  it("rejects invalid files before OCR is called", async () => {
    await expectAiError(
      () => extractText(mock(), textFile),
      "unsupported_file",
    );
  });
  it.each(["", "   \n ", "!!! ... ---"])(
    "unreadable output %j becomes no_text",
    async (ocrText) => {
      await expectAiError(
        () => extractText(new MockLumenClient({ ocrText }), JPEG),
        "no_text",
      );
    },
  );
  it("maps OCR failures to safe codes", async () => {
    await expectAiError(
      () => extractText(new MockLumenClient({ ocrFailure: "error" }), JPEG),
      "upstream_error",
    );
    await expectAiError(
      () => extractText(new MockLumenClient({ ocrFailure: "timeout" }), JPEG),
      "timeout",
    );
  });
  it("converts unexpected client exceptions into a generic code (no message leaks)", async () => {
    const leaky = {
      provenance: "mock" as const,
      maxMessageChars: 4000,
      ocr: async () => {
        throw new Error("boom: secret-in-message");
      },
      chat: async () => ({ text: "{}" }),
    };
    await expectAiError(() => extractText(leaky, JPEG), "upstream_error");
  });
});

describe("analysis: Filipino and English, classification, dates, sources", () => {
  it("explains a Filipino notice in Filipino with verified evidence", async () => {
    const r = await analyzeDocument(mock(), {
      text: BARANGAY_FIL,
      language: "fil",
    });
    expect(r.provenance).toBe("mock");
    expect(r.classification.type).toBe("barangay_notice");
    expect(r.summary).toMatch(/Ito ay|Mula ito sa/);
    expect(r.dates[0].dateText).toBe("ika-20 ng Nobyembre 2026");
    expect(r.dates[0].timeText).toBe("alas-9:00 ng umaga");
    expect(r.sender?.name).toBe("Tanggapan ng Barangay Malinaw");
    expect(r.disclaimer).toMatch(/Hindi ito legal advice/);
    for (const d of r.dates)
      expect(BARANGAY_FIL.slice(d.evidence.start, d.evidence.end)).toBe(
        d.evidence.quote,
      );
  });
  it("explains the same kind of notice in English", async () => {
    const r = await analyzeDocument(mock(), {
      text: DEMAND_EN,
      language: "en",
    });
    expect(r.classification.type).toBe("demand_letter");
    expect(r.summary).toMatch(/This is a|It is from/);
    expect(r.dates[0]).toMatchObject({
      dateText: "December 5, 2026",
      kind: "deadline",
    });
    expect(r.disclaimer).toMatch(/not legal advice/i);
  });
  it("returns unrecognized (not a forced guess) for an unclear document", async () => {
    const r = await analyzeDocument(mock(), { text: UNCLEAR, language: "en" });
    expect(r.classification.type).toBe("unrecognized");
    expect(r.dates).toEqual([]);
    expect(r.uncertaintyNotes).toContainEqual({ code: "no_dates_found" });
    // Nothing is backed by the document, so the frontend mapping refuses it.
    expect(toFrontendAnalysis(r)).toBeNull();
  });
  it("every date and quote it returns is an exact slice of the text", async () => {
    const r = await analyzeDocument(mock(), {
      text: DEMAND_EN,
      language: "en",
    });
    const quotes = [
      ...r.dates.map((d) => d.evidence),
      ...r.importantPoints.flatMap((p) => (p.evidence ? [p.evidence] : [])),
    ];
    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes)
      expect(exactSource(DEMAND_EN, q.quote)).toBe(q.start);
  });
  it("the frontend view model passes the frontend's own source check", async () => {
    const r = await analyzeDocument(mock(), {
      text: BARANGAY_FIL,
      language: "fil",
    });
    const a = toFrontendAnalysis(r)!;
    expect(exactSource(BARANGAY_FIL, a.quote)).toBeGreaterThanOrEqual(0);
    expect(a.summary).toContain("[MOCK");
  });
  it("review and correction: re-analysis follows the edited text, old evidence goes stale", async () => {
    const before = await analyzeDocument(mock(), {
      text: BARANGAY_FIL,
      language: "fil",
    });
    const edited = BARANGAY_FIL.replace(
      "ika-20 ng Nobyembre",
      "ika-27 ng Nobyembre",
    );
    const after = await analyzeDocument(mock(), {
      text: edited,
      language: "fil",
    });
    expect(after.dates[0].dateText).toBe("ika-27 ng Nobyembre 2026");
    expect(
      markOutdated(
        before.dates.map((d) => d.evidence),
        edited,
      )[0].outdated,
    ).toBe(true);
  });
  it("a user-chosen type overrides the model", async () => {
    const r = await analyzeDocument(mock(), {
      text: BARANGAY_FIL,
      language: "fil",
      noticeType: "court_notice",
    });
    expect(r.classification).toMatchObject({
      type: "court_notice",
      source: "user",
    });
  });
  it("is not hijacked by instructions inside the document", async () => {
    const r = await analyzeDocument(mock(), {
      text: INJECTION,
      language: "en",
    });
    expect(r.summary.toLowerCase()).not.toContain("will win");
    expect(r.dates[0].dateText).toBe("November 20, 2026");
  });
  it("end to end on the mock OCR text", async () => {
    const ocr = await extractText(mock(), PNG);
    const r = await analyzeDocument(mock(), {
      text: ocr.text,
      language: "fil",
    });
    expect(r.classification.type).toBe("barangay_notice");
    expect(MOCK_OCR_BODY).toContain(r.dates[0].dateText);
  });
});

describe("analysis rejects bad or hostile model output", () => {
  /** A mock whose real reply is edited before it is returned. */
  const tampered = (mutate: (reply: Record<string, unknown>) => void) => {
    const base = new MockLumenClient();
    return new MockLumenClient({
      chatOverride: async (prompt) => {
        const reply = JSON.parse((await base.chat({ prompt })).text);
        mutate(reply);
        return JSON.stringify(reply);
      },
    });
  };
  const run = (client: MockLumenClient, language: "fil" | "en" = "fil") =>
    analyzeDocument(client, { text: BARANGAY_FIL, language });

  it("fails (no partial render) when the model returns invalid JSON", async () => {
    const client = new MockLumenClient({
      chatOverride: () => "Sure! Here is the answer",
    });
    await expectAiError(() => run(client), "invalid_model_output");
  });
  it("fails when the summary is missing", async () => {
    await expectAiError(
      () => run(tampered((r) => delete r.summary)),
      "invalid_model_output",
    );
  });
  it("withholds an explanation containing an outcome prediction", async () => {
    await expectAiError(
      () =>
        run(
          tampered((r) => (r.summary = "You will win this case.")),
          "en",
        ),
      "guardrail_blocked",
    );
  });
  it("withholds next steps that tell the user to pay or sign", async () => {
    await expectAiError(
      () =>
        run(
          tampered((r) => (r.nextSteps = ["You should pay the amount today."])),
          "en",
        ),
      "guardrail_blocked",
    );
  });
  it("drops fabricated dates instead of trusting them", async () => {
    const r = await run(
      tampered((reply) => {
        reply.dates = [
          {
            kind: "deadline",
            label: "x",
            dateText: "December 31, 2026",
            timeText: null,
            quote: "Pay by December 31, 2026 or face arrest.",
          },
        ];
      }),
    );
    expect(r.dates).toEqual([]);
    expect(r.uncertaintyNotes).toContainEqual({
      code: "unsupported_dates_removed",
    });
  });
  it("marks fabricated claims instead of trusting them", async () => {
    const r = await run(
      tampered((reply) => {
        reply.points = [
          {
            text: "May multa na PHP 5,000.",
            kind: "amount",
            basis: "document",
            quote: "multa na PHP 5,000",
          },
        ];
      }),
    );
    expect(r.importantPoints[0]).toMatchObject({
      status: "not_stated",
      evidence: null,
    });
    expect(r.uncertaintyNotes).toContainEqual({
      code: "unsupported_claims_removed",
    });
  });
  it("accepts a quote the model re-joined across a line break, as the original slice", async () => {
    const wrapped =
      "Inaanyayahan kayong dumalo sa pag-uusap sa\nbarangay sa ika-20 ng Nobyembre 2026.\nMula sa: Tanggapan ng Barangay Halimbawa";
    const r = await analyzeDocument(
      tampered((reply) => {
        reply.dates = [
          {
            kind: "appearance",
            label: "x",
            dateText: "ika-20 ng Nobyembre 2026",
            timeText: null,
            quote:
              "dumalo sa pag-uusap sa barangay sa ika-20 ng Nobyembre 2026.",
          },
        ];
      }),
      { text: wrapped, language: "fil" },
    );
    expect(r.dates).toHaveLength(1);
    expect(
      wrapped.slice(r.dates[0].evidence.start, r.dates[0].evidence.end),
    ).toBe(r.dates[0].evidence.quote);
    expect(r.dates[0].evidence.quote).toContain("\n");
  });
  it("downgrades a classification whose quote is invented", async () => {
    const r = await run(
      tampered((reply) => {
        reply.type = "subpoena";
        reply.confidence = 99;
        reply.typeEvidence = "SUBPOENA DUCES TECUM";
      }),
    );
    expect(r.classification.type).toBe("unrecognized");
  });
  it("downgrades a classification whose 'evidence' is just the type name", async () => {
    // Seen in a real Lumen reply during testing: typeQuote was "barangay_notice".
    const r = await run(
      tampered((reply) => {
        reply.type = "barangay_notice";
        reply.typeEvidence = "barangay_notice";
      }),
    );
    expect(r.classification.type).toBe("unrecognized");
  });
  it("times out a model call that never answers", async () => {
    const { withTimeout } = await import("../../src/server/ai/call");
    await expectAiError(
      () => withTimeout(20, () => new Promise<never>(() => undefined)),
      "timeout",
    );
  });
});

describe("a real reply captured from the Lumen sandbox (fictional notice)", () => {
  // Captured before the prompt template was fixed: the model echoed the
  // template placeholder "<copied passage>" as its type evidence.
  const real = JSON.parse(
    readFileSync(
      join(process.cwd(), "tests/fixtures/lumen-real-analyze-reply.json"),
      "utf8",
    ),
  ) as { ocrText: string; reply: string };
  const analyzeReal = () =>
    analyzeDocument(new MockLumenClient({ chatOverride: () => real.reply }), {
      text: real.ocrText,
      language: "fil",
    });

  it("grounds the real date, time, sender and points as exact slices of the OCR text", async () => {
    const r = await analyzeReal();
    expect(r.dates).toHaveLength(1);
    expect(r.dates[0].dateText).toBe("ika-20 ng Nobyembre 2026");
    expect(r.dates[0].timeText).toBe("alas-9:00 ng umaga");
    expect(r.sender?.name).toBe("Tanggapan ng Barangay Halimbawa");
    const all = [
      r.dates[0].evidence,
      r.sender!.evidence!,
      ...r.importantPoints.flatMap((p) => (p.evidence ? [p.evidence] : [])),
    ];
    expect(r.importantPoints.every((p) => p.status === "supported")).toBe(true);
    for (const e of all)
      expect(real.ocrText.slice(e.start, e.end)).toBe(e.quote);
  });
  it("does not accept the echoed placeholder as evidence, so the type is not asserted", async () => {
    const r = await analyzeReal();
    expect(r.classification.type).toBe("unrecognized");
    expect(r.classification.notes).toContainEqual({
      code: "unsupported_classification",
    });
  });
  it("still produces a usable frontend view with the real date and sender", async () => {
    const view = toFrontendAnalysis(await analyzeReal())!;
    expect(view.date).toBe("ika-20 ng Nobyembre 2026");
    expect(view.sender).toBe("Tanggapan ng Barangay Halimbawa");
    expect(exactSource(real.ocrText, view.quote)).toBeGreaterThanOrEqual(0);
  });
});

describe("message size limit (Lumen: 4000 characters, instructions included)", () => {
  it("refuses a document that cannot fit, before anything is sent", async () => {
    let called = 0;
    const base = new MockLumenClient();
    const spy = {
      provenance: "mock" as const,
      maxMessageChars: base.maxMessageChars,
      ocr: base.ocr.bind(base),
      chat: async (i: Parameters<typeof base.chat>[0]) => {
        called += 1;
        return base.chat(i);
      },
    };
    const long = `${BARANGAY_FIL}\n${"Karagdagang talata ng dokumento. ".repeat(120)}`;
    expect(long.length).toBeGreaterThan(3000);
    await expectAiError(
      () => analyzeDocument(spy, { text: long, language: "fil" }),
      "document_too_long",
    );
    expect(called).toBe(0);
  });
  it("accepts a document that just fits", async () => {
    const filler = "x ".repeat(5);
    // Build the largest text that still fits, using the real prompt builder.
    const { renderMessage } = await import("../../src/server/prompts/shared");
    const { buildAnalyzePrompt } = await import("../../src/server/prompts");
    const { MESSAGE_BUDGET_CHARS } = await import("../../src/server/ai/limits");
    let text = BARANGAY_FIL;
    while (
      renderMessage(
        buildAnalyzePrompt({ text: text + filler, language: "fil" }),
      ).length <= MESSAGE_BUDGET_CHARS
    )
      text += filler;
    const r = await analyzeDocument(mock(), { text, language: "fil" });
    expect(r.classification.type).toBe("barangay_notice");
  });
  it("applies to follow-up questions too", async () => {
    const long = `${BARANGAY_FIL}\n${"Karagdagang talata. ".repeat(250)}`;
    await expectAiError(
      () =>
        answerQuestion(mock(), {
          text: long,
          question: "Kailan?",
          language: "fil",
        }),
      "document_too_long",
    );
  });
});

describe("chat: context handling and grounding", () => {
  const ask = (text: string, question: string, language: "fil" | "en") =>
    answerQuestion(mock(), { text, question, language });

  it("answers from the provided document and attaches a verified source", async () => {
    const r = await ask(BARANGAY_FIL, "Kailan ang pag-uusap?", "fil");
    expect(r.answeredFromDocument).toBe(true);
    expect(r.answer).toContain("ika-20 ng Nobyembre 2026");
    const reply = toFrontendChat(r);
    expect(exactSource(BARANGAY_FIL, reply.quote!)).toBeGreaterThanOrEqual(0);
  });
  it("uses the document it is given, not a previous one", async () => {
    const a = await ask(DEMAND_EN, "When is the date?", "en");
    const b = await ask(BARANGAY_FIL, "When is the date?", "en");
    expect(a.answer).toContain("December 5, 2026");
    expect(b.answer).toContain("ika-20 ng Nobyembre 2026");
  });
  it("answers in the selected language", async () => {
    expect((await ask(BARANGAY_FIL, "When?", "en")).answer).toMatch(
      /According to the document/,
    );
    expect((await ask(BARANGAY_FIL, "Kailan?", "fil")).answer).toMatch(
      /Ayon sa dokumento/,
    );
  });
  it("says 'not stated' and attaches no source when the document has no answer", async () => {
    const r = await ask(BARANGAY_FIL, "Magkano ang multa?", "fil");
    expect(r.answeredFromDocument).toBe(false);
    expect(r.answer.startsWith(NOT_STATED.fil)).toBe(true);
    expect(toFrontendChat(r).quote).toBeUndefined();
  });
  it("also says 'not stated' when asked about a date the document lacks", async () => {
    const r = await ask(UNCLEAR, "When is the hearing date?", "en");
    expect(r.answeredFromDocument).toBe(false);
    expect(r.answer.startsWith(NOT_STATED.en)).toBe(true);
  });
  it("declines advice requests, says it is not a lawyer, and keeps the disclaimer", async () => {
    const r = await ask(DEMAND_EN, "Should I pay this?", "en");
    expect(r.declined).toBe(true);
    expect(r.answer).toMatch(/not a lawyer/i);
    expect(r.disclaimer).toMatch(/not legal advice/i);
    const f = await ask(BARANGAY_FIL, "Dapat ba akong magbayad?", "fil");
    expect(f.declined).toBe(true);
    expect(f.answer).toMatch(/abogado/i);
  });
  it("does not trust 'answered from document' without a verified quote", async () => {
    const client = new MockLumenClient({
      chatOverride: () =>
        JSON.stringify({
          answer: "The fine is PHP 5,000.",
          answeredFromDocument: true,
          claims: [
            {
              text: "fine",
              kind: "amount",
              basis: "document",
              quote: "fine of PHP 5,000",
            },
          ],
        }),
    });
    const r = await answerQuestion(client, {
      text: BARANGAY_FIL,
      question: "How much?",
      language: "en",
    });
    expect(r.answeredFromDocument).toBe(false);
    expect(r.claims[0].status).toBe("not_stated");
    expect(toFrontendChat(r).quote).toBeUndefined();
  });
  it("withholds an answer that predicts the outcome", async () => {
    const client = new MockLumenClient({
      chatOverride: () =>
        JSON.stringify({
          answer: "Don't worry, you will win.",
          answeredFromDocument: false,
          claims: [],
        }),
    });
    await expectAiError(
      () =>
        answerQuestion(client, {
          text: BARANGAY_FIL,
          question: "Will it be ok?",
          language: "en",
        }),
      "guardrail_blocked",
    );
  });
  describe("when the service declines in plain prose (seen on the real Lumen chat instance)", () => {
    const REFUSAL = "That question is outside what this assistant covers.";
    const reply = (text: string) =>
      new MockLumenClient({ chatOverride: () => text });
    const ask = (text: string) =>
      answerQuestion(reply(text), {
        text: BARANGAY_FIL,
        question: "Magkano ang multa?",
        language: "fil",
      });

    it("reports out_of_scope, not a generic failure and not 'not stated'", async () => {
      await expectAiError(() => ask(REFUSAL), "out_of_scope");
    });
    it("does not mistake broken or truncated JSON for a refusal", async () => {
      await expectAiError(
        () => ask('{"answer": "Ayon sa dokumento'),
        "invalid_model_output",
      );
      await expectAiError(
        () => ask("```json\n{broken"),
        "invalid_model_output",
      );
    });
    it("does not mistake a long rambling reply for a refusal", async () => {
      await expectAiError(
        () => ask("Lorem ipsum. ".repeat(60)),
        "invalid_model_output",
      );
    });
    it("an empty reply is still invalid output", async () => {
      await expectAiError(() => ask("   "), "invalid_model_output");
    });
    it("analysis never treats prose as a refusal", async () => {
      await expectAiError(
        () =>
          analyzeDocument(reply(REFUSAL), {
            text: BARANGAY_FIL,
            language: "fil",
          }),
        "invalid_model_output",
      );
    });
  });
  it("fails on malformed model output", async () => {
    const client = new MockLumenClient({
      chatOverride: () => '{"answer": "putol na JSON',
    });
    await expectAiError(
      () =>
        answerQuestion(client, {
          text: BARANGAY_FIL,
          question: "When?",
          language: "en",
        }),
      "invalid_model_output",
    );
  });
});
