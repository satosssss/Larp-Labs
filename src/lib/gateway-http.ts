import type { ChatResult, NoticeGateway } from "./gateway";
import type { Analysis } from "./sample";

/**
 * Same-origin adapter for the AI routes. The browser only ever talks to our
 * own /api/* endpoints; Lumen and its credentials exist on the server only.
 * Failures reject with AiRequestError carrying a short code, never a message
 * that could contain document text.
 */

export class AiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "AiRequestError";
  }
}

async function send(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AiRequestError("network", 0);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body: fall through to the generic error below.
  }
  if (!response.ok) {
    const code =
      (body as { error?: { code?: unknown } } | null)?.error?.code ?? "unknown";
    throw new AiRequestError(
      typeof code === "string" ? code : "unknown",
      response.status,
    );
  }
  return body;
}

const isString = (v: unknown): v is string => typeof v === "string";

function asAnalysis(value: unknown): Analysis {
  const a = value as Partial<Record<keyof Analysis, unknown>> | null;
  if (
    !a ||
    (a.language !== "fil" && a.language !== "en") ||
    !isString(a.type) ||
    !isString(a.summary) ||
    !isString(a.quote) ||
    !isString(a.explanation) ||
    !isString(a.date) ||
    !isString(a.time) ||
    !isString(a.sender)
  )
    throw new AiRequestError("bad_response", 502);
  return a as Analysis;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const aiGateway: Pick<NoticeGateway, "extract" | "analyze" | "chat"> = {
  async extract(file, signal) {
    const form = new FormData();
    form.set("file", file);
    const body = (await send(
      "/api/ocr",
      { method: "POST", body: form },
      signal,
    )) as {
      text?: unknown;
    } | null;
    if (!isString(body?.text)) throw new AiRequestError("bad_response", 502);
    return { text: body.text };
  },
  async analyze(text, language, signal) {
    const body = (await send(
      "/api/analyze",
      json({ text, language }),
      signal,
    )) as {
      analysis?: unknown;
    } | null;
    return asAnalysis(body?.analysis);
  },
  async chat(input, signal) {
    const body = (await send("/api/chat", json(input), signal)) as {
      reply?: Partial<ChatResult>;
    } | null;
    const reply = body?.reply;
    if (!reply || !isString(reply.text))
      throw new AiRequestError("bad_response", 502);
    return {
      text: reply.text,
      ...(isString(reply.quote) ? { quote: reply.quote } : {}),
    };
  },
};
