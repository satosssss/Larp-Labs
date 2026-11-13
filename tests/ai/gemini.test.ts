import { describe, expect, it, vi } from "vitest";
import { createGeminiModel, GeminiMockModel } from "../../src/server/ai/gemini-client";
import {
  GEMINI_DEFAULT_MODEL,
  normalizeModel,
  readGeminiConfig,
} from "../../src/server/ai/gemini-config";
import {
  buildGeminiRequest,
  GEMINI_KEY_HEADER,
  LiveGeminiClient,
  mapGeminiError,
} from "../../src/server/ai/gemini-live";
import { buildAnalyzePrompt } from "../../src/server/prompts";
import { buildGroundedQaPrompt } from "../../src/server/prompts";
import { expectAiError } from "./helpers";

const prompt = () =>
  buildAnalyzePrompt({ text: "PAANYAYA SA PAG-UUSAP", language: "fil" });
const qaPrompt = () =>
  buildGroundedQaPrompt({
    text: "PAANYAYA SA PAG-UUSAP",
    question: "Kailan?",
    language: "fil",
  });

const CONFIG = {
  apiKey: "key-SECRET-123",
  model: "gemini-2.5-flash",
  origin: "https://gemini.test",
};

type Call = { url: string; init: RequestInit };

/** A fetch double speaking Gemini's generateContent response shape. */
function fakeGemini(
  handler: (call: Call) => Response | Promise<Response> = () =>
    Response.json({
      candidates: [
        { content: { parts: [{ text: '{"summary":"ok"}' }] }, finishReason: "STOP" },
      ],
    }),
) {
  const calls: Call[] = [];
  const fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const errorResponse = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

describe("Gemini request shape", () => {
  it("maps our prompt to systemInstruction plus one user turn asking for JSON", () => {
    const body = buildGeminiRequest(prompt());
    expect(body.systemInstruction?.parts[0].text).toContain("<document>");
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[0].parts[0].text).toContain("<document>");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(1000);
  });
  it("sends the key only in the documented header, over HTTPS, with no redirect", async () => {
    const fake = fakeGemini();
    const client = new LiveGeminiClient(CONFIG, { fetch: fake.fetch });
    await client.chat({ prompt: prompt() });
    const [call] = fake.calls;
    expect(call.url).toBe(
      "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent",
    );
    const headers = call.init.headers as Record<string, string>;
    expect(headers[GEMINI_KEY_HEADER]).toBe(CONFIG.apiKey);
    expect(call.init.redirect).toBe("error");
    expect(call.init.cache).toBe("no-store");
    expect(JSON.stringify(call.init.body)).not.toContain(CONFIG.apiKey);
  });
  it("joins every returned part and keeps provenance 'gemini'", async () => {
    const fake = fakeGemini(() =>
      Response.json({
        candidates: [
          {
            content: { parts: [{ text: '{"a":' }, { text: "1}" }] },
            finishReason: "STOP",
          },
        ],
      }),
    );
    const client = new LiveGeminiClient(CONFIG, { fetch: fake.fetch });
    const out = await client.chat({ prompt: prompt() });
    expect(out.text).toBe('{"a":1}');
    expect(client.provenance).toBe("gemini");
    expect(client.maxMessageChars).toBeGreaterThan(20_000);
  });
});

describe("Gemini failures map to safe codes", () => {
  it.each([
    [400, {}, "invalid_request"],
    [401, {}, "not_configured"],
    [403, {}, "upstream_denied"],
    [404, {}, "not_configured"],
    [429, {}, "rate_limited"],
    [500, {}, "upstream_error"],
    [503, {}, "upstream_error"],
  ] as const)("status %i becomes %s", async (status, body, code) => {
    const fake = fakeGemini(() => errorResponse(status, body));
    const client = new LiveGeminiClient(CONFIG, { fetch: fake.fetch });
    await expectAiError(() => client.chat({ prompt: prompt() }), code);
  });
  it("treats an invalid API key as not configured", async () => {
    const fake = fakeGemini(() =>
      errorResponse(400, {
        error: {
          status: "INVALID_ARGUMENT",
          details: [{ reason: "API_KEY_INVALID" }],
        },
      }),
    );
    const client = new LiveGeminiClient(CONFIG, { fetch: fake.fetch });
    await expectAiError(() => client.chat({ prompt: prompt() }), "not_configured");
  });
  it("maps an aborted request to timeout and a network throw to upstream_error", async () => {
    const controller = new AbortController();
    const aborted = new LiveGeminiClient(CONFIG, {
      fetch: (async () => {
        controller.abort();
        throw new Error("aborted");
      }) as unknown as typeof globalThis.fetch,
    });
    await expectAiError(
      () => aborted.chat({ prompt: prompt(), signal: controller.signal }),
      "timeout",
    );
    const broken = new LiveGeminiClient(CONFIG, {
      fetch: (async () => {
        throw new Error("socket hang up");
      }) as unknown as typeof globalThis.fetch,
    });
    await expectAiError(() => broken.chat({ prompt: prompt() }), "upstream_error");
  });
  it("rejects a blocked prompt, a safety finish, truncation and empty text", async () => {
    const blocked = new LiveGeminiClient(CONFIG, {
      fetch: fakeGemini(() =>
        Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
      ).fetch,
    });
    await expectAiError(
      () => blocked.chat({ prompt: prompt() }),
      "invalid_model_output",
    );
    for (const finishReason of ["SAFETY", "MAX_TOKENS", "RECITATION"]) {
      const client = new LiveGeminiClient(CONFIG, {
        fetch: fakeGemini(() =>
          Response.json({
            candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason }],
          }),
        ).fetch,
      });
      await expectAiError(
        () => client.chat({ prompt: prompt() }),
        "invalid_model_output",
      );
    }
    const empty = new LiveGeminiClient(CONFIG, {
      fetch: fakeGemini(() =>
        Response.json({
          candidates: [{ content: { parts: [] }, finishReason: "STOP" }],
        }),
      ).fetch,
    });
    await expectAiError(() => empty.chat({ prompt: prompt() }), "invalid_model_output");
  });
  it("reports a blocked chat prompt as out_of_scope", async () => {
    const client = new LiveGeminiClient(CONFIG, {
      fetch: fakeGemini(() =>
        Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
      ).fetch,
    });
    await expectAiError(
      () => client.chat({ prompt: qaPrompt() }),
      "out_of_scope",
    );
  });
  it("never puts upstream text or the key into an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = fakeGemini(() =>
      errorResponse(500, { error: { message: `echo ${CONFIG.apiKey}` } }),
    );
    const client = new LiveGeminiClient(CONFIG, { fetch: fake.fetch });
    try {
      await client.chat({ prompt: prompt() });
    } catch (error) {
      expect((error as Error).message).toBe("upstream_error");
      expect(JSON.stringify(error)).not.toContain(CONFIG.apiKey);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("Gemini configuration", () => {
  it("defaults the model and reads the key", () => {
    expect(readGeminiConfig({ GEMINI_API_KEY: "k" })).toMatchObject({
      apiKey: "k",
      model: GEMINI_DEFAULT_MODEL,
      origin: "https://generativelanguage.googleapis.com",
    });
  });
  it("accepts a models/ prefix and rejects a path-like model id", () => {
    expect(normalizeModel("models/gemini-2.5-flash")).toBe("gemini-2.5-flash");
    expect(normalizeModel("gemini-2.5-flash")).toBe("gemini-2.5-flash");
    expect(normalizeModel("../../secret")).toBeNull();
    expect(() =>
      readGeminiConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "../x" }),
    ).toThrow();
  });
  it("refuses a missing key and an unsafe origin", () => {
    expect(() => readGeminiConfig({})).toThrow();
    expect(() => readGeminiConfig({ GEMINI_API_KEY: " " })).toThrow();
    for (const origin of [
      "http://gemini.test",
      "https://gemini.test/v1beta",
      "https://user:pw@gemini.test",
    ])
      expect(() =>
        readGeminiConfig({ GEMINI_API_KEY: "k", GEMINI_API_ORIGIN: origin }),
      ).toThrow();
  });
  it("runs without credentials in mock mode and is clearly labeled mock", async () => {
    const model = createGeminiModel({ GEMINI_MODE: "mock" });
    expect(model).toBeInstanceOf(GeminiMockModel);
    expect(model.provenance).toBe("mock");
    const out = await model.chat({ prompt: prompt() });
    expect(out.text).toContain("summary");
  });
  it("never falls back to mock when the live configuration is missing", () => {
    expect(() => createGeminiModel({})).toThrow();
    expect(() => createGeminiModel({ GEMINI_MODE: "live" })).toThrow();
  });
});

describe("mapGeminiError", () => {
  it("prioritizes an invalid key over the status", () => {
    expect(mapGeminiError(400, true)).toBe("not_configured");
    expect(mapGeminiError(429, false)).toBe("rate_limited");
  });
});
