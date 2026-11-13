import type { Provenance } from "../../lib/ai-types";
import { renderMessage } from "../prompts/shared";
import type { LiveLumenConfig } from "./config";
import { AiError, type AiErrorCode } from "./errors";
import {
  LUMEN_MESSAGE_MAX_CHARS,
  OCR_POLL_INITIAL_MS,
  OCR_POLL_MAX_MS,
} from "./limits";
import type {
  AcceptedMime,
  ChatInput,
  ChatOutput,
  LumenClient,
  OcrInput,
  OcrOutput,
  OcrPage,
} from "./lumen-client";

/**
 * Real Lumen client, written from the official OCR and AI Chat OpenAPI specs
 * plus the response shapes observed on the sandbox gateway.
 *
 * Security rules, enforced here:
 *  - credentials go only in the two request headers below, only over HTTPS to
 *    the configured origin, and are never logged, returned or put in errors;
 *  - errors carry only our own codes. Lumen's error `message` is never read,
 *    because it can echo input; only its short `code` is used;
 *  - the user's file name is never sent (a generic name is used instead);
 *  - session ids are created per request and never accepted from the browser,
 *    so one visitor can never continue another visitor's conversation.
 *
 * Lumen retains uploaded documents and chat transcripts and its developer API
 * cannot delete them. That is a product/privacy decision for the team, not
 * something this client can change.
 */

export const LUMEN_KEY_HEADER = "lumen-api-key";
export const LUMEN_SECRET_HEADER = "lumen-api-secret";

export function lumenAuthHeaders(
  config: Pick<LiveLumenConfig, "apiKey" | "apiSecret">,
): Record<string, string> {
  return {
    [LUMEN_KEY_HEADER]: config.apiKey,
    [LUMEN_SECRET_HEADER]: config.apiSecret,
  };
}

type FetchLike = typeof fetch;
type Json = Record<string, unknown>;

const EXTENSION: Record<AcceptedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

const isRecord = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Maps a failed Lumen response to one of our safe codes. Uses status and code only. */
export function mapLumenError(status: number, code: string): AiErrorCode {
  if (status === 401) return "not_configured";
  if (status === 403)
    return code === "SESSION_NOT_OWNED" ? "upstream_error" : "upstream_denied";
  if (status === 413) return "file_too_large";
  if (status === 415) return "unsupported_file";
  if (status === 429) return "rate_limited";
  if (status === 504 || code === "AI_CHAT_REPLY_TIMEOUT") return "timeout";
  if (status === 400) return "invalid_request";
  return "upstream_error";
}

// Instances rarely change, so the discovered id is shared across requests.
const instanceCache = new Map<string, string>();

export class LiveLumenClient implements LumenClient {
  readonly provenance: Provenance = "lumen";
  readonly maxMessageChars = LUMEN_MESSAGE_MAX_CHARS;
  // Held privately and never serialized.
  readonly #config: LiveLumenConfig;
  readonly #fetch: FetchLike;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(
    config: LiveLumenConfig,
    options: { fetch?: FetchLike; sleep?: (ms: number) => Promise<void> } = {},
  ) {
    this.#config = config;
    this.#fetch = options.fetch ?? fetch;
    this.#sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** One authenticated request. Returns parsed JSON or throws a safe AiError. */
  async #request(
    path: string,
    init: {
      method: "GET" | "POST";
      body?: BodyInit;
      headers?: Record<string, string>;
    },
    signal?: AbortSignal,
  ): Promise<{ status: number; body: Json }> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#config.origin}${path}`, {
        method: init.method,
        body: init.body,
        headers: { ...lumenAuthHeaders(this.#config), ...init.headers },
        signal,
        redirect: "error", // never follow a redirect with credentials attached
        cache: "no-store",
      });
    } catch {
      throw new AiError(signal?.aborted ? "timeout" : "upstream_error");
    }
    let body: Json = {};
    try {
      const parsed: unknown = await response.json();
      if (isRecord(parsed)) body = parsed;
    } catch {
      // Empty or non-JSON body: handled by the status check below.
    }
    if (!response.ok) {
      const error = isRecord(body.error) ? body.error : {};
      const code = typeof error.code === "string" ? error.code : "";
      throw new AiError(mapLumenError(response.status, code));
    }
    return { status: response.status, body };
  }

  // ---------------------------------------------------------------- OCR --

  async ocr(input: OcrInput): Promise<OcrOutput> {
    const { signal } = input;
    const upload = await this.#request(
      "/ocr/documents",
      {
        method: "POST",
        // Raw bytes, as the docs require (not multipart, not base64).
        body: input.bytes as BodyInit,
        headers: {
          "Content-Type": input.mime,
          "X-Lumen-Document-Name": encodeURIComponent(
            `legalinaw-upload.${EXTENSION[input.mime]}`,
          ),
        },
      },
      signal,
    );
    const documentId = this.#dataOf(upload.body).DocumentID;
    if (typeof documentId !== "string" || !documentId)
      throw new AiError("upstream_error");
    const id = encodeURIComponent(documentId);

    // Poll until the read finishes. The caller's timeout aborts `signal`.
    let delay = OCR_POLL_INITIAL_MS;
    let record = this.#dataOf(upload.body);
    for (;;) {
      const status = record.Status;
      if (status === "READY" || status === "PARTIAL") break;
      if (status === "FAILED") throw new AiError(this.#failureCode(record));
      if (signal?.aborted) throw new AiError("timeout");
      await this.#sleep(delay);
      delay = Math.min(OCR_POLL_MAX_MS, Math.round(delay * 1.5));
      record = this.#dataOf(
        (await this.#request(`/ocr/documents/${id}`, { method: "GET" }, signal))
          .body,
      );
    }

    const failedPages = Array.isArray(record.FailedPageNumbers)
      ? record.FailedPageNumbers.filter(
          (n): n is number => Number.isInteger(n) && (n as number) > 0,
        )
      : [];
    const pageCount = Number.isInteger(record.PageCount)
      ? (record.PageCount as number)
      : 0;

    const pages: OcrPage[] = [];
    const numbers = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
      (n) => !failedPages.includes(n),
    );
    const fetched = await Promise.all(
      numbers.map((n) =>
        this.#request(
          `/ocr/documents/${id}/pages/${n}`,
          { method: "GET" },
          signal,
        ),
      ),
    );
    fetched.forEach((res, i) => {
      const page = this.#parsePage(numbers[i], this.#dataOf(res.body));
      if (page) pages.push(page);
    });

    return {
      text: pages.map((p) => p.text).join("\n\n"),
      pages,
      ...(failedPages.length ? { failedPages } : {}),
    };
  }

  #dataOf(body: Json): Json {
    return isRecord(body.data) ? body.data : {};
  }

  #failureCode(record: Json): AiErrorCode {
    switch (record.FailureReason) {
      case "timeout":
        return "timeout";
      case "unsupported_media":
        return "unsupported_file";
      case "corrupt_document":
        return "unreadable_file";
      case "invalid_request":
        return "invalid_request";
      default:
        return "upstream_error";
    }
  }

  /** Reads text from a page: lines when present, otherwise words. */
  #parsePage(page: number, data: Json): OcrPage | null {
    const textOf = (items: unknown): string[] =>
      Array.isArray(items)
        ? items.flatMap((item) =>
            isRecord(item) && typeof item.text === "string" ? [item.text] : [],
          )
        : [];
    const lines = textOf(data.Lines);
    const text = lines.length ? lines.join("\n") : textOf(data.Words).join(" ");
    const measured =
      isRecord(data.Confidence) && data.Confidence.measured === true
        ? data.Confidence.value
        : undefined;
    const confidence =
      typeof measured === "number" && Number.isFinite(measured)
        ? Math.min(100, Math.max(0, Math.round(measured * 100)))
        : undefined;
    return {
      page,
      text,
      ...(confidence === undefined ? {} : { confidence }),
    };
  }

  // --------------------------------------------------------------- chat --

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { prompt, signal } = input;
    // Lumen has no system role: instructions and document share one message.
    const message = renderMessage(prompt);
    if (message.length > LUMEN_MESSAGE_MAX_CHARS)
      throw new AiError("document_too_long");

    const instanceId = await this.#resolveInstance(signal);
    const instance = encodeURIComponent(instanceId);
    const session = await this.#request(
      `/ai_chat/instances/${instance}/sessions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "LegaLinaw" }),
      },
      signal,
    );
    const sessionObj = isRecord(session.body.Session)
      ? session.body.Session
      : {};
    if (typeof sessionObj.id !== "string" || !sessionObj.id)
      throw new AiError("upstream_error");

    const reply = await this.#request(
      `/ai_chat/instances/${instance}/sessions/${encodeURIComponent(sessionObj.id)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      },
      signal,
    );
    const answer = isRecord(reply.body.Answer) ? reply.body.Answer : {};
    if (typeof answer.answer !== "string" || !answer.answer.trim())
      throw new AiError("invalid_model_output");
    return { text: answer.answer };
  }

  async #resolveInstance(signal?: AbortSignal): Promise<string> {
    if (this.#config.instanceId) return this.#config.instanceId;
    const cached = instanceCache.get(this.#config.origin);
    if (cached) return cached;
    const { body } = await this.#request(
      "/ai_chat/instances",
      { method: "GET" },
      signal,
    );
    const instances = Array.isArray(body.Instances) ? body.Instances : [];
    const active = instances.find(
      (i): i is Json =>
        isRecord(i) &&
        i.Status === "ACTIVE" &&
        typeof i.InstanceID === "string" &&
        i.InstanceID.length > 0,
    );
    if (!active) throw new AiError("not_configured");
    const id = active.InstanceID as string;
    instanceCache.set(this.#config.origin, id);
    return id;
  }
}

/** Test helper: forget discovered instances. */
export const resetInstanceCache = () => instanceCache.clear();
