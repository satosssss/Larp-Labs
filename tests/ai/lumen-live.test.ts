/**
 * Tests for the LIVE client against a SIMULATED Lumen (tests/ai/fake-lumen.ts).
 * They prove how our client behaves given the documented and observed response
 * shapes. They do not prove the real service works; see tests/live for that.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, type AiErrorCode } from "../../src/server/ai/errors";
import {
  LiveLumenClient,
  mapLumenError,
  resetInstanceCache,
} from "../../src/server/ai/lumen-live";
import { buildAnalyzePrompt } from "../../src/server/prompts";
import { renderMessage } from "../../src/server/prompts/shared";
import { BARANGAY_FIL } from "../fixtures/notices";
import { FAKE_CONFIG, fakeLumen, type FakeOptions } from "./fake-lumen";
import { JPEG, PNG, expectAiError, pdf } from "./helpers";

beforeEach(() => resetInstanceCache());

const setup = (options: FakeOptions = {}, config = FAKE_CONFIG) => {
  const fake = fakeLumen(options);
  const sleep = vi.fn(async (ms: number) => void ms);
  const client = new LiveLumenClient(config, { fetch: fake.fetch, sleep });
  return { ...fake, sleep, client };
};

describe("requests: auth, URLs and privacy", () => {
  it("sends the exact documented header names with the configured values on every call", async () => {
    const { client, calls } = setup({ answer: '{"ok":true}' });
    await client.ocr({ bytes: PNG, mime: "image/png" });
    await client.chat({
      prompt: buildAnalyzePrompt({ text: BARANGAY_FIL, language: "fil" }),
    });
    expect(calls.length).toBeGreaterThan(6);
    for (const call of calls) {
      expect(call.headers["lumen-api-key"]).toBe(FAKE_CONFIG.apiKey);
      expect(call.headers["lumen-api-secret"]).toBe(FAKE_CONFIG.apiSecret);
    }
  });
  it("only talks to the configured https origin and never puts credentials in a URL", async () => {
    const { client, calls } = setup({ answer: "{}" });
    await client.ocr({ bytes: PNG, mime: "image/png" });
    await client.chat({
      prompt: buildAnalyzePrompt({ text: "x", language: "en" }),
    });
    for (const call of calls) {
      expect(call.url.startsWith("https://lumen.test/")).toBe(true);
      expect(call.url).not.toMatch(/SECRET|test-key|test-secret/);
    }
  });
  it("refuses to follow redirects, so credentials cannot be forwarded elsewhere", async () => {
    const { client, calls } = setup();
    await client.ocr({ bytes: PNG, mime: "image/png" });
    for (const call of calls) expect(call.redirect).toBe("error");
  });
  it("uploads raw bytes with the right content type and a generic document name", async () => {
    for (const [bytes, mime, ext] of [
      [PNG, "image/png", "png"],
      [JPEG, "image/jpeg", "jpg"],
      [pdf(1), "application/pdf", "pdf"],
    ] as const) {
      const { client, calls } = setup();
      await client.ocr({ bytes, mime });
      const upload = calls[0];
      expect(upload.method).toBe("POST");
      expect(upload.path).toBe("/ocr/documents");
      expect(upload.headers["Content-Type"]).toBe(mime);
      expect(upload.body).toBe(bytes); // raw bytes, not multipart or base64
      expect(decodeURIComponent(upload.headers["X-Lumen-Document-Name"])).toBe(
        `legalinaw-upload.${ext}`,
      );
    }
  });
});

describe("OCR flow", () => {
  it("uploads, polls until READY, then reads each page and joins the lines", async () => {
    const { client, calls, sleep } = setup({
      statuses: ["PROCESSING", "READY"],
      pages: {
        1: {
          lines: ["BARANGAY HALIMBAWA", "PAANYAYA SA PAG-UUSAP"],
          confidence: 0.9847,
        },
      },
    });
    const out = await client.ocr({ bytes: PNG, mime: "image/png" });
    expect(out.text).toBe("BARANGAY HALIMBAWA\nPAANYAYA SA PAG-UUSAP");
    expect(out.pages).toEqual([{ page: 1, text: out.text, confidence: 98 }]);
    expect(out.failedPages).toBeUndefined();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /ocr/documents",
      "GET /ocr/documents/doc-1",
      "GET /ocr/documents/doc-1",
      "GET /ocr/documents/doc-1/pages/1",
    ]);
    // Backs off between polls: 1s, then 1.5s.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 1500]);
  });
  it("joins multiple pages with a blank line", async () => {
    const { client } = setup({
      statuses: ["READY"],
      pageCount: 2,
      pages: { 1: { lines: ["Una"] }, 2: { lines: ["Ikalawa"] } },
    });
    expect((await client.ocr({ bytes: PNG, mime: "image/png" })).text).toBe(
      "Una\n\nIkalawa",
    );
  });
  it("returns what it could read on PARTIAL and reports the failed pages", async () => {
    const { client, calls } = setup({
      statuses: ["PARTIAL"],
      pageCount: 3,
      failedPages: [2],
      pages: { 1: { lines: ["Una"] }, 3: { lines: ["Ikatlo"] } },
    });
    const out = await client.ocr({ bytes: PNG, mime: "image/png" });
    expect(out.text).toBe("Una\n\nIkatlo");
    expect(out.failedPages).toEqual([2]);
    // The failed page is never requested.
    expect(calls.some((c) => c.path.endsWith("/pages/2"))).toBe(false);
  });
  it("falls back to words when a page has no lines", async () => {
    const { client } = setup({
      statuses: ["READY"],
      pages: { 1: { words: ["Hello", "world"] } },
    });
    expect((await client.ocr({ bytes: PNG, mime: "image/png" })).text).toBe(
      "Hello world",
    );
  });
  it("leaves confidence out when the engine did not measure it", async () => {
    const { client } = setup({
      statuses: ["READY"],
      pages: { 1: { lines: ["Hello"] } },
    });
    const out = await client.ocr({ bytes: PNG, mime: "image/png" });
    expect(out.pages?.[0]).toEqual({ page: 1, text: "Hello" });
  });
  it.each([
    ["timeout", "timeout"],
    ["unavailable", "upstream_error"],
    ["unsupported_media", "unsupported_file"],
    ["corrupt_document", "unreadable_file"],
    ["invalid_request", "invalid_request"],
    [undefined, "upstream_error"],
  ] as [string | undefined, AiErrorCode][])(
    "maps a FAILED read (%s) to %s",
    async (failureReason, code) => {
      const { client } = setup({ statuses: ["FAILED"], failureReason });
      await expectAiError(
        () => client.ocr({ bytes: PNG, mime: "image/png" }),
        code,
      );
    },
  );
  it("stops polling with a timeout error when the caller aborts", async () => {
    const controller = new AbortController();
    const fake = fakeLumen({ statuses: ["PROCESSING"] }); // never finishes
    const client = new LiveLumenClient(FAKE_CONFIG, {
      fetch: fake.fetch,
      sleep: async () => controller.abort(),
    });
    await expectAiError(
      () =>
        client.ocr({
          bytes: PNG,
          mime: "image/png",
          signal: controller.signal,
        }),
      "timeout",
    );
  });
});

describe("chat flow", () => {
  const prompt = () =>
    buildAnalyzePrompt({ text: BARANGAY_FIL, language: "fil" });

  it("finds the ACTIVE instance, opens a session, sends one message, returns the answer text", async () => {
    const { client, calls } = setup({ answer: '{"summary":"ok"}' });
    const out = await client.chat({ prompt: prompt() });
    expect(out.text).toBe('{"summary":"ok"}');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /ai_chat/instances",
      "POST /ai_chat/instances/inst-1/sessions",
      "POST /ai_chat/instances/inst-1/sessions/sess-1/messages",
    ]);
    // The whole prompt travels as the single message, and nothing else.
    expect(JSON.parse(calls[2].body as string)).toEqual({
      message: renderMessage(prompt()),
    });
    // The session title carries no document information.
    expect(JSON.parse(calls[1].body as string)).toEqual({ title: "LegaLinaw" });
  });
  it("uses a fresh session per request and remembers the instance", async () => {
    const { client, calls } = setup({ answer: "{}" });
    await client.chat({ prompt: prompt() });
    await client.chat({ prompt: prompt() });
    expect(calls.filter((c) => c.path === "/ai_chat/instances")).toHaveLength(
      1,
    );
    const sessionPosts = calls.filter((c) => c.path.endsWith("/sessions"));
    expect(sessionPosts).toHaveLength(2);
    const messagePaths = calls
      .filter((c) => c.path.endsWith("/messages"))
      .map((c) => c.path);
    expect(new Set(messagePaths).size).toBe(2); // sess-1 then sess-2, never reused
  });
  it("uses the configured instance id without listing instances", async () => {
    const { client, calls } = setup(
      { answer: "{}" },
      { ...FAKE_CONFIG, instanceId: "configured-inst" },
    );
    await client.chat({ prompt: prompt() });
    expect(calls.some((c) => c.path === "/ai_chat/instances")).toBe(false);
    expect(calls[0].path).toBe("/ai_chat/instances/configured-inst/sessions");
  });
  it("skips non-active instances and fails safely when none is usable", async () => {
    const ok = setup({
      answer: "{}",
      instances: [
        { InstanceID: "old", Status: "ARCHIVED" },
        { InstanceID: "good", Status: "ACTIVE" },
      ],
    });
    await ok.client.chat({ prompt: prompt() });
    expect(ok.calls[1].path).toBe("/ai_chat/instances/good/sessions");

    resetInstanceCache();
    const none = setup({
      instances: [{ InstanceID: "old", Status: "ARCHIVED" }],
    });
    await expectAiError(
      () => none.client.chat({ prompt: prompt() }),
      "not_configured",
    );
  });
  it("rejects an over-long message before sending anything", async () => {
    const { client, calls } = setup({ answer: "{}" });
    const long = buildAnalyzePrompt({ text: "x".repeat(4000), language: "en" });
    await expectAiError(
      () => client.chat({ prompt: long }),
      "document_too_long",
    );
    expect(calls).toHaveLength(0);
  });
  it("treats an empty answer as invalid model output", async () => {
    const { client } = setup({ answer: "   " });
    await expectAiError(
      () => client.chat({ prompt: prompt() }),
      "invalid_model_output",
    );
  });
});

describe("error mapping uses status and code only", () => {
  it.each([
    [401, "INVALID_API_CREDENTIALS", "not_configured"],
    [401, "API_KEY_NOT_FOUND", "not_configured"],
    [403, "ACCESS_DENIED", "upstream_denied"],
    [403, "VIEW_ONLY_ACCESS", "upstream_denied"],
    [403, "API_CREDITS_INSUFFICIENT", "upstream_denied"],
    [403, "LC_INSUFFICIENT", "upstream_denied"],
    [403, "SESSION_NOT_OWNED", "upstream_error"],
    [413, "", "file_too_large"],
    [415, "", "unsupported_file"],
    [429, "AI_CHAT_MODEL_RATE_LIMITED", "rate_limited"],
    [429, "RATE_LIMIT_EXCEEDED", "rate_limited"],
    [504, "AI_CHAT_REPLY_TIMEOUT", "timeout"],
    [400, "VALIDATION_ERROR", "invalid_request"],
    [404, "AI_CHAT_SESSION_NOT_FOUND", "upstream_error"],
    [409, "AI_CHAT_CONFLICT", "upstream_error"],
    [502, "AI_CHAT_MODEL_UPSTREAM_ERROR", "upstream_error"],
    [503, "FEATURE_DISABLED", "upstream_error"],
  ] as [number, string, AiErrorCode][])(
    "%s %s -> %s",
    (status, code, expected) => {
      expect(mapLumenError(status, code)).toBe(expected);
    },
  );

  it("never lets Lumen's message, the credentials or the document reach an error", async () => {
    const message =
      "LEAK-ME echo of key test-key-SECRETKEYVALUE and Barangay Halimbawa";
    const { client } = setup({
      fail: () => ({ status: 403, code: "ACCESS_DENIED", message }),
    });
    const error = await client
      .chat({
        prompt: buildAnalyzePrompt({ text: BARANGAY_FIL, language: "fil" }),
      })
      .catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe("upstream_denied");
    const dump = `${String(error)} ${error.message} ${JSON.stringify(error)} ${error.stack ?? ""}`;
    expect(dump).not.toMatch(/LEAK-ME|SECRET|Halimbawa/);
  });
  it("maps a network failure to a safe code without leaking the cause", async () => {
    const client = new LiveLumenClient(FAKE_CONFIG, {
      fetch: (async () => {
        throw new Error(
          "connect ECONNREFUSED 10.0.0.1 secret=SECRETSECRETVALUE",
        );
      }) as typeof fetch,
      sleep: async () => undefined,
    });
    const error = await client
      .ocr({ bytes: PNG, mime: "image/png" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe("upstream_error");
    expect(`${error.message} ${JSON.stringify(error)}`).not.toMatch(
      /ECONNREFUSED|SECRET/,
    );
  });
  it("reports a timeout when the request was aborted", async () => {
    const controller = new AbortController();
    const client = new LiveLumenClient(FAKE_CONFIG, {
      fetch: (async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      }) as typeof fetch,
      sleep: async () => undefined,
    });
    await expectAiError(
      () =>
        client.ocr({
          bytes: PNG,
          mime: "image/png",
          signal: controller.signal,
        }),
      "timeout",
    );
  });
  it("treats a non-JSON success body as an upstream error, not a crash", async () => {
    const client = new LiveLumenClient(FAKE_CONFIG, {
      fetch: (async () =>
        new Response("<html>gateway</html>", { status: 200 })) as typeof fetch,
      sleep: async () => undefined,
    });
    await expectAiError(
      () => client.ocr({ bytes: PNG, mime: "image/png" }),
      "upstream_error",
    );
  });
});
