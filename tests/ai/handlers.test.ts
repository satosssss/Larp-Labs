import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readLumenConfig } from "../../src/server/ai/config";
import {
  handleAnalyze,
  handleChat,
  handleOcr,
  type Deps,
} from "../../src/server/ai/handlers";
import { createLumenClient } from "../../src/server/ai/lumen-client";
import { RateLimiter } from "../../src/server/ai/rate-limit";
import { FAKE_CONFIG, fakeLumen } from "./fake-lumen";
import {
  LiveLumenClient,
  LUMEN_KEY_HEADER,
  LUMEN_SECRET_HEADER,
  lumenAuthHeaders,
} from "../../src/server/ai/lumen-live";
import { MOCK_OCR_MARK, MockLumenClient } from "../../src/server/ai/lumen-mock";
import { MAX_FILE_BYTES, MAX_TEXT_CHARS } from "../../src/server/ai/limits";
import { exactSource } from "../../src/lib/flow";
import { BARANGAY_FIL, UNCLEAR } from "../fixtures/notices";
import { JPEG, PNG, pdf, textFile } from "./helpers";

const mockDeps: Deps = { getClient: () => new MockLumenClient() };

const upload = (bytes: Uint8Array, name = "notice.png", type = "image/png") => {
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], name, { type }));
  return new Request("http://localhost/api/ocr", {
    method: "POST",
    body: form,
  });
};
const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

afterEach(() => vi.restoreAllMocks());

describe("POST /api/ocr", () => {
  it("returns marked mock text and identifies mock mode in header and body", async () => {
    const res = await handleOcr(upload(PNG), mockDeps);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-LegaLinaw-AI-Mode")).toBe("mock");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.mode).toBe("mock");
    expect(body.text.startsWith(MOCK_OCR_MARK)).toBe(true);
  });
  it("judges a file by its bytes: a text file named .png is rejected", async () => {
    const res = await handleOcr(
      upload(textFile, "scan.png", "image/png"),
      mockDeps,
    );
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("unsupported_file");
  });
  it("accepts a PDF and a JPEG regardless of the reported type", async () => {
    expect(
      (
        await handleOcr(
          upload(pdf(1), "a.bin", "application/octet-stream"),
          mockDeps,
        )
      ).status,
    ).toBe(200);
    expect(
      (await handleOcr(upload(JPEG, "a.txt", "text/plain"), mockDeps)).status,
    ).toBe(200);
  });
  it("rejects an oversized file with 413", async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(JPEG);
    const res = await handleOcr(upload(big, "big.jpg", "image/jpeg"), mockDeps);
    expect(res.status).toBe(413);
  });
  it("rejects an empty file, a missing file and a non-multipart body", async () => {
    expect((await handleOcr(upload(new Uint8Array()), mockDeps)).status).toBe(
      422,
    );
    const empty = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: new FormData(),
    });
    expect((await handleOcr(empty, mockDeps)).status).toBe(400);
    expect((await handleOcr(post("/api/ocr", {}), mockDeps)).status).toBe(400);
  });
  it("reports unreadable OCR as no_text and upstream failures safely", async () => {
    const none: Deps = {
      getClient: () => new MockLumenClient({ ocrText: "  " }),
    };
    const res = await handleOcr(upload(PNG), none);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("no_text");
    const down: Deps = {
      getClient: () => new MockLumenClient({ ocrFailure: "error" }),
    };
    expect((await handleOcr(upload(PNG), down)).status).toBe(502);
  });
});

describe("POST /api/analyze", () => {
  it("returns a frontend-compatible Analysis whose quote is in the text", async () => {
    const res = await handleAnalyze(
      post("/api/analyze", { text: BARANGAY_FIL, language: "fil" }),
      mockDeps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-LegaLinaw-AI-Mode")).toBe("mock");
    const { analysis, detail, mode } = await res.json();
    expect(mode).toBe("mock");
    expect(detail.provenance).toBe("mock");
    expect(exactSource(BARANGAY_FIL, analysis.quote)).toBeGreaterThanOrEqual(0);
    expect(analysis.summary).toContain("[MOCK");
  });
  it("validates the request", async () => {
    const bad = async (body: unknown) =>
      (await handleAnalyze(post("/api/analyze", body), mockDeps)).status;
    expect(await bad("{not json")).toBe(400);
    expect(await bad([])).toBe(400);
    expect(await bad({ text: "", language: "fil" })).toBe(400);
    expect(await bad({ text: "   ", language: "fil" })).toBe(400);
    expect(await bad({ text: 5 })).toBe(400);
    expect(await bad({ text: "valid text here", noticeType: "banana" })).toBe(
      400,
    );
    expect(await bad({ text: "x".repeat(MAX_TEXT_CHARS + 1) })).toBe(422);
  });
  it("rejects text over 20,000 characters, and text too long for one AI message", async () => {
    const code = async (n: number) =>
      (
        await (
          await handleAnalyze(
            post("/api/analyze", { text: "x".repeat(n), language: "en" }),
            mockDeps,
          )
        ).json()
      ).error?.code;
    expect(await code(MAX_TEXT_CHARS + 1)).toBe("text_too_long");
    // At the spec limit the request is valid, but it cannot fit in one
    // 4000-character Lumen message, so the user is asked to shorten it.
    expect(await code(MAX_TEXT_CHARS)).toBe("document_too_long");
  });
  it("refuses to present an explanation that nothing in the document supports", async () => {
    const res = await handleAnalyze(
      post("/api/analyze", { text: UNCLEAR, language: "en" }),
      mockDeps,
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("unsupported");
  });
  it("localizes safe errors", async () => {
    const en = await (
      await handleAnalyze(
        post("/api/analyze", { text: "", language: "en" }),
        mockDeps,
      )
    ).json();
    const fil = await (
      await handleAnalyze(
        post("/api/analyze", { text: "", language: "fil" }),
        mockDeps,
      )
    ).json();
    expect(en.error.message).toMatch(/not valid/i);
    expect(fil.error.message).toMatch(/Hindi balido/);
  });
});

describe("POST /api/chat", () => {
  it("answers from the posted document with a verified source", async () => {
    const res = await handleChat(
      post("/api/chat", {
        text: BARANGAY_FIL,
        question: "Kailan ang pag-uusap?",
        language: "fil",
      }),
      mockDeps,
    );
    expect(res.status).toBe(200);
    const { reply } = await res.json();
    expect(reply.text).toContain("ika-20 ng Nobyembre 2026");
    expect(exactSource(BARANGAY_FIL, reply.quote)).toBeGreaterThanOrEqual(0);
  });
  it("enforces the 1-500 character question rule", async () => {
    const status = async (question: unknown) =>
      (
        await handleChat(
          post("/api/chat", { text: BARANGAY_FIL, question, language: "en" }),
          mockDeps,
        )
      ).status;
    expect(await status("")).toBe(400);
    expect(await status("   ")).toBe(400);
    expect(await status("a".repeat(501))).toBe(400);
    expect(await status("a".repeat(500))).toBe(200);
  });
});

describe("missing or unfinished credentials fail safely", () => {
  const configured = (env: Record<string, string | undefined>): Deps => ({
    getClient: () => createLumenClient(readLumenConfig(env)),
  });
  const SECRET_KEY = "key-SECRETVALUE-111";
  const SECRET_SECRET = "sec-SECRETVALUE-222";
  const GOOD_ENV = {
    LUMEN_API_KEY: SECRET_KEY,
    LUMEN_API_SECRET: SECRET_SECRET,
    LUMEN_API_ORIGIN: "https://lumen.test",
  };

  it("returns 503 not_configured with a generic message and no fallback to mock", async () => {
    for (const env of [
      {},
      { LUMEN_API_KEY: SECRET_KEY },
      { LUMEN_API_SECRET: SECRET_SECRET },
      { LUMEN_API_KEY: " ", LUMEN_API_SECRET: " " },
      // Credentials without an origin, or with an unsafe one, are not usable.
      { LUMEN_API_KEY: SECRET_KEY, LUMEN_API_SECRET: SECRET_SECRET },
      { ...GOOD_ENV, LUMEN_API_ORIGIN: "http://insecure.example" },
      { ...GOOD_ENV, LUMEN_API_ORIGIN: "https://user:pw@lumen.test" },
      { ...GOOD_ENV, LUMEN_API_ORIGIN: "https://lumen.test/ocr" },
    ]) {
      const res = await handleAnalyze(
        post("/api/analyze", { text: BARANGAY_FIL, language: "en" }),
        configured(env),
      );
      expect(res.status).toBe(503);
      const text = await res.text();
      expect(JSON.parse(text).error.code).toBe("not_configured");
      expect(text).not.toMatch(/SECRETVALUE|LUMEN_|mock/i);
    }
  });
  it("when Lumen rejects the credentials: 503, a generic message, and nothing sensitive in responses or logs", async () => {
    const spies = (["error", "warn", "log", "info"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const fake = fakeLumen({
      fail: () => ({
        status: 401,
        code: "INVALID_API_CREDENTIALS",
        message: `echo ${SECRET_KEY} ${SECRET_SECRET}`,
      }),
    });
    const deps: Deps = {
      getClient: () =>
        new LiveLumenClient(
          { ...FAKE_CONFIG, apiKey: SECRET_KEY, apiSecret: SECRET_SECRET },
          { fetch: fake.fetch, sleep: async () => undefined },
        ),
    };
    const responses = [
      await handleOcr(upload(PNG), deps),
      await handleAnalyze(
        post("/api/analyze", { text: BARANGAY_FIL, language: "en" }),
        deps,
      ),
      await handleChat(
        post("/api/chat", {
          text: BARANGAY_FIL,
          question: "When?",
          language: "en",
        }),
        deps,
      ),
    ];
    for (const res of responses) {
      expect(res.status).toBe(503);
      expect(res.headers.get("X-LegaLinaw-AI-Mode")).toBeNull();
      const body = await res.text();
      expect(JSON.parse(body).error.code).toBe("not_configured");
      expect(body).not.toMatch(/SECRETVALUE|echo/);
    }
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain("SECRETVALUE");
    expect(logged).not.toContain(BARANGAY_FIL.slice(0, 20));
  });
  it("mock mode needs no credentials; an unset mode never defaults to mock", () => {
    expect(readLumenConfig({ LUMEN_MODE: "mock" })).toEqual({ mode: "mock" });
    expect(() => readLumenConfig({})).toThrow();
    expect(() => readLumenConfig({ LUMEN_MODE: "live" })).toThrow();
  });
  it("unexpected internal errors return a generic 500 with no details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom: Deps = {
      getClient: () => {
        throw new Error("db password is hunter2");
      },
    };
    const res = await handleAnalyze(
      post("/api/analyze", { text: BARANGAY_FIL, language: "en" }),
      boom,
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("hunter2");
  });
});

describe("failures never log document content", () => {
  it("logs only the route and an error code", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await handleAnalyze(
      post("/api/analyze", { text: UNCLEAR, language: "en" }),
      mockDeps,
    );
    await handleChat(
      post("/api/chat", {
        text: BARANGAY_FIL,
        question: "x".repeat(501),
        language: "en",
      }),
      mockDeps,
    );
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls)
      expect(String(call[0])).toMatch(/^\[ai\] \w+ failed: \w+$/);
  });
});

describe("credential handling", () => {
  it("sends the exact documented header names", () => {
    expect(LUMEN_KEY_HEADER).toBe("lumen-api-key");
    expect(LUMEN_SECRET_HEADER).toBe("lumen-api-secret");
    expect(lumenAuthHeaders({ apiKey: "k", apiSecret: "s" })).toEqual({
      "lumen-api-key": "k",
      "lumen-api-secret": "s",
    });
  });
  it("only config.ts reads the credential variables; no NEXT_PUBLIC_ Lumen variable exists", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) files.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    const readers = files.filter(
      (f) =>
        /process\.env/.test(readFileSync(f, "utf8")) &&
        /LUMEN_API/.test(readFileSync(f, "utf8")),
    );
    expect(readers.map((f) => f.split("/src/")[1])).toEqual([
      "server/ai/config.ts",
    ]);
    const mentions = files.filter((f) =>
      /LUMEN_API_(KEY|SECRET)/.test(readFileSync(f, "utf8")),
    );
    expect(mentions.map((f) => f.split("/src/")[1])).toEqual([
      "server/ai/config.ts",
    ]);
    for (const f of files)
      expect(readFileSync(f, "utf8")).not.toMatch(/NEXT_PUBLIC_LUMEN/);
  });
  it(".env files are gitignored and .env.example holds no values", () => {
    const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).toMatch(/^LUMEN_API_KEY=$/m);
    expect(example).toMatch(/^LUMEN_API_SECRET=$/m);
    expect(example).not.toMatch(/NEXT_PUBLIC_LUMEN/);
  });
});

describe("live client through the HTTP handlers (simulated Lumen, not the real API)", () => {
  /** Replies to the combined analysis and Q&A prompts with realistic JSON. */
  const answer = (message: string) => {
    if (message.includes("Question:"))
      return JSON.stringify({
        answer: "Ayon sa dokumento: ika-20 ng Nobyembre 2026.",
        answeredFromDocument: true,
        declined: false,
        claims: [
          {
            text: "petsa",
            kind: "date",
            basis: "document",
            quote:
              "tanggapan ng barangay sa ika-20 ng Nobyembre 2026, alas-9:00 ng umaga",
          },
        ],
      });
    return JSON.stringify({
      type: "barangay_notice",
      confidence: 95,
      typeEvidence: "PAANYAYA SA PAG-UUSAP",
      summary: "Inaanyayahan ka sa pag-uusap sa barangay.",
      sender: {
        name: "Tanggapan ng Barangay Halimbawa",
        quote: "Mula sa: Tanggapan ng Barangay Halimbawa",
      },
      dates: [
        {
          kind: "appearance",
          label: "Pag-uusap",
          dateText: "ika-20 ng Nobyembre 2026",
          timeText: "alas-9:00 ng umaga",
          quote: "ika-20 ng Nobyembre 2026, alas-9:00 ng umaga",
        },
      ],
      points: [],
      nextSteps: ["Dalhin ang liham na ito."],
    });
  };
  const OCR_TEXT =
    "BARANGAY HALIMBAWA\nPAANYAYA SA PAG-UUSAP\nInaanyayahan kayong dumalo sa isang pag-uusap sa\ntanggapan ng barangay sa ika-20 ng Nobyembre 2026,\nalas-9:00 ng umaga.\nMula sa: Tanggapan ng Barangay Halimbawa";
  const liveDeps = (limiter?: RateLimiter): Deps => {
    const fake = fakeLumen({
      pages: { 1: { lines: OCR_TEXT.split("\n") } },
      answer,
    });
    return {
      getClient: () =>
        new LiveLumenClient(FAKE_CONFIG, {
          fetch: fake.fetch,
          sleep: async () => undefined,
        }),
      limiter,
    };
  };

  it("OCR, analysis and chat all work and are labeled 'lumen', not 'mock'", async () => {
    const deps = liveDeps();
    const ocr = await handleOcr(upload(PNG), deps);
    expect(ocr.status).toBe(200);
    expect(ocr.headers.get("X-LegaLinaw-AI-Mode")).toBe("lumen");
    const { text, mode } = await ocr.json();
    expect(mode).toBe("lumen");
    expect(text).toBe(OCR_TEXT);

    const analyze = await handleAnalyze(
      post("/api/analyze", { text, language: "fil" }),
      deps,
    );
    expect(analyze.status).toBe(200);
    const { analysis, detail } = await analyze.json();
    expect(detail.provenance).toBe("lumen");
    expect(analysis.summary).not.toContain("MOCK");
    expect(analysis.type).toBe("Paunawa mula sa barangay");
    expect(analysis.date).toBe("ika-20 ng Nobyembre 2026");
    // The model's quote joined hard-wrapped lines with a space; the quote the
    // frontend receives is the original slice, so its own check passes.
    expect(exactSource(text, analysis.quote)).toBeGreaterThanOrEqual(0);

    const chat = await handleChat(
      post("/api/chat", {
        text,
        question: "Kailan ang pag-uusap?",
        language: "fil",
      }),
      deps,
    );
    const { reply } = await chat.json();
    expect(reply.text).not.toContain("MOCK");
    expect(exactSource(text, reply.quote)).toBeGreaterThanOrEqual(0);
  });
  it("reports an incomplete read when some pages could not be recognized", async () => {
    const fake = fakeLumen({
      statuses: ["PARTIAL"],
      pageCount: 2,
      failedPages: [2],
      pages: { 1: { lines: ["Una lang ang nabasa"] } },
    });
    const deps: Deps = {
      getClient: () =>
        new LiveLumenClient(FAKE_CONFIG, {
          fetch: fake.fetch,
          sleep: async () => undefined,
        }),
    };
    const body = await (await handleOcr(upload(PNG), deps)).json();
    expect(body).toMatchObject({ incomplete: true, failedPages: [2] });
  });
});

describe("rate limiting protects credits (live calls only)", () => {
  const live = (limiter: RateLimiter): Deps => ({
    getClient: () =>
      new LiveLumenClient(FAKE_CONFIG, {
        fetch: fakeLumen({ answer: "{}" }).fetch,
        sleep: async () => undefined,
      }),
    limiter,
  });
  const ask = (deps: Deps, ip = "1.1.1.1") =>
    handleChat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `${ip}, 10.0.0.1`,
        },
        body: JSON.stringify({
          text: BARANGAY_FIL,
          question: "When?",
          language: "en",
        }),
      }),
      deps,
    );

  it("allows the configured number of requests, then answers 429 with Retry-After", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = live(new RateLimiter(2, 60_000));
    // The simulated reply is "{}", so these fail later in the pipeline, but
    // they still count: the limiter runs before any credits are spent.
    expect((await ask(deps)).status).not.toBe(429);
    expect((await ask(deps)).status).not.toBe(429);
    const limited = await ask(deps);
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("rate_limited");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("counts each client separately", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = live(new RateLimiter(1, 60_000));
    expect((await ask(deps, "1.1.1.1")).status).not.toBe(429);
    expect((await ask(deps, "2.2.2.2")).status).not.toBe(429);
    expect((await ask(deps, "1.1.1.1")).status).toBe(429);
  });
  it("does not charge invalid requests", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = live(new RateLimiter(1, 60_000));
    for (let i = 0; i < 5; i += 1) {
      const bad = await handleChat(
        post("/api/chat", { text: "", question: "", language: "en" }),
        deps,
      );
      expect(bad.status).toBe(400);
    }
    expect((await ask(deps)).status).not.toBe(429);
  });
  it("does not charge invalid uploads, and never sends them to Lumen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = fakeLumen({ pages: { 1: { lines: ["Hello world"] } } });
    const deps: Deps = {
      getClient: () =>
        new LiveLumenClient(FAKE_CONFIG, {
          fetch: fake.fetch,
          sleep: async () => undefined,
        }),
      limiter: new RateLimiter(1, 60_000),
    };
    for (const bad of [textFile, new Uint8Array(), pdf(1, "", false)])
      expect(
        (await handleOcr(upload(bad), deps)).status,
      ).toBeGreaterThanOrEqual(400);
    expect(fake.calls).toHaveLength(0); // nothing reached Lumen
    // The single allowed live request is still available for a good file.
    expect((await handleOcr(upload(PNG), deps)).status).toBe(200);
    expect((await handleOcr(upload(PNG), deps)).status).toBe(429);
  });
  it("never throttles mock mode", async () => {
    const deps: Deps = { ...mockDeps, limiter: new RateLimiter(1, 60_000) };
    for (let i = 0; i < 5; i += 1) expect((await ask(deps)).status).toBe(200);
  });
});
