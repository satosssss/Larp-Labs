import { afterEach, describe, expect, it, vi } from "vitest";
import { AiRequestError, aiGateway } from "../../src/lib/gateway-http";
import { gateway } from "../../src/lib/gateway";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => vi.unstubAllGlobals());

const analysis = {
  language: "fil",
  type: "Paunawa mula sa barangay",
  summary: "s",
  quote: "q",
  explanation: "e",
  date: "d",
  time: "t",
  sender: "x",
};

describe("browser gateway adapter", () => {
  it("is wired into the app gateway for extract, analyze and chat", async () => {
    expect(gateway.extract).toBe(aiGateway.extract);
    expect(gateway.analyze).toBe(aiGateway.analyze);
    expect(gateway.chat).toBe(aiGateway.chat);
    // Not built yet (directory and PDF export) stays disconnected.
    for (const method of [gateway.providers, gateway.report])
      await expect((method as () => Promise<unknown>)()).rejects.toThrow(
        "Service not connected",
      );
  });
  it("posts the file to the same-origin OCR route and sends no credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply({ text: "nabasang text", mode: "mock" }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "n.png", {
      type: "image/png",
    });
    await expect(aiGateway.extract(file)).resolves.toEqual({
      text: "nabasang text",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ocr");
    expect(init.credentials).toBe("same-origin");
    expect(
      JSON.stringify(Object.fromEntries(new Headers(init.headers ?? {}))),
    ).not.toMatch(/lumen/i);
  });
  it("posts reviewed text for analysis and returns only the frontend Analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ analysis, detail: { big: true } })),
    );
    await expect(aiGateway.analyze("teksto", "fil")).resolves.toEqual(analysis);
  });
  it("posts chat input and returns text with an optional quote", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply({ reply: { text: "sagot", quote: "q" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      aiGateway.chat({ text: "t", question: "?", language: "en" }),
    ).resolves.toEqual({ text: "sagot", quote: "q" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      text: "t",
      question: "?",
      language: "en",
    });
  });
  it("turns server errors into a short code and never a message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          reply({ error: { code: "no_text", message: "x" } }, 422),
        ),
    );
    const err = await aiGateway.analyze("t", "en").catch((e) => e);
    expect(err).toBeInstanceOf(AiRequestError);
    expect(err).toMatchObject({
      code: "no_text",
      status: 422,
      message: "no_text",
    });
  });
  it("maps network failure and malformed responses to errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    expect(await aiGateway.analyze("t", "en").catch((e) => e)).toMatchObject({
      code: "network",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ analysis: { summary: 1 } })),
    );
    expect(await aiGateway.analyze("t", "en").catch((e) => e)).toMatchObject({
      code: "bad_response",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({})));
    expect(
      await aiGateway.extract(new File([], "a.png")).catch((e) => e),
    ).toMatchObject({ code: "bad_response" });
  });
  it("passes cancellation through so the UI can abort", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          (_u: string, init: RequestInit) =>
            new Promise((_, reject) =>
              init.signal?.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError")),
              ),
            ),
        ),
    );
    const pending = aiGateway
      .analyze("t", "en", controller.signal)
      .catch((e) => e);
    controller.abort();
    expect((await pending).name).toBe("AbortError");
  });
});
