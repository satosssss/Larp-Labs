/**
 * A SIMULATED Lumen gateway for tests: a `fetch` replacement that speaks the
 * OCR and AI Chat shapes documented in Lumen's OpenAPI specs and observed on
 * the sandbox gateway. It never touches the network. Tests that use it prove
 * how OUR client behaves against those shapes, not that the real service works.
 */

import type { LiveLumenConfig } from "../../src/server/ai/config";

export type Call = {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body: Uint8Array | string | null;
  redirect: string | undefined;
};

export type FakePage = {
  lines?: string[];
  words?: string[];
  confidence?: number;
};

export type FakeOptions = {
  /** Status values returned by successive GET /ocr/documents/{id} polls. */
  statuses?: string[];
  pageCount?: number;
  pages?: Record<number, FakePage>;
  failedPages?: number[];
  failureReason?: string;
  instances?: { InstanceID: string; Status: string; Name?: string }[];
  answer?: string | ((message: string) => string);
  /** Return a value to make a call fail with that status and error body. */
  fail?: (
    call: Call,
  ) => { status: number; code: string; message?: string } | undefined;
};

const word = (text: string) => ({
  text,
  box: { x: 0.1, y: 0.1, w: 0.1, h: 0.01 },
  confidence: { measured: true, value: 1, unit: "word" },
});
const line = (text: string) => ({
  text,
  box: { x: 0.1, y: 0.1, w: 0.5, h: 0.01 },
  confidence: { measured: true, value: 0.99, unit: "word" },
  words: text.split(" ").map(word),
});

export function fakeLumen(options: FakeOptions = {}) {
  const calls: Call[] = [];
  const statuses = [...(options.statuses ?? ["PROCESSING", "READY"])];
  const pageCount = options.pageCount ?? 1;
  let sessions = 0;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const doFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>),
    );
    const raw = init?.body;
    const call: Call = {
      method: init?.method ?? "GET",
      url: url.href,
      path: url.pathname,
      headers,
      body:
        raw instanceof Uint8Array
          ? raw
          : typeof raw === "string"
            ? raw
            : raw
              ? new Uint8Array(raw as ArrayBuffer)
              : null,
      redirect: init?.redirect,
    };
    calls.push(call);

    const failure = options.fail?.(call);
    if (failure)
      return json(failure.status, {
        error: { code: failure.code, message: failure.message ?? "failed" },
      });

    const p = call.path;
    if (call.method === "POST" && p === "/ocr/documents")
      return json(202, {
        data: {
          DocumentID: "doc-1",
          Name: "legalinaw-upload.png",
          MediaType: headers["Content-Type"],
          ByteSize: (call.body as Uint8Array).length,
          PageCount: 0,
          Status: "PENDING",
          FailedPageNumbers: [],
          CreatedTS: 1,
        },
        requestId: "r1",
      });
    if (call.method === "GET" && p === "/ocr/documents/doc-1") {
      const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
      const done = status === "READY" || status === "PARTIAL";
      return json(200, {
        data: {
          DocumentID: "doc-1",
          Status: status,
          PageCount: done ? pageCount : 0,
          FailedPageNumbers: options.failedPages ?? [],
          ...(status === "FAILED"
            ? { FailureReason: options.failureReason }
            : {}),
        },
        requestId: "r2",
      });
    }
    const pageMatch = /^\/ocr\/documents\/doc-1\/pages\/(\d+)$/.exec(p);
    if (call.method === "GET" && pageMatch) {
      const n = Number(pageMatch[1]);
      const page = options.pages?.[n] ?? { lines: [`Linya ng pahina ${n}`] };
      return json(200, {
        data: {
          DocumentID: "doc-1",
          PageNumber: n,
          Confidence: {
            measured: page.confidence !== undefined,
            value: page.confidence ?? 0,
            unit: "word",
          },
          Words: (
            page.words ??
            page.lines?.flatMap((l) => l.split(" ")) ??
            []
          ).map(word),
          ...(page.lines ? { Lines: page.lines.map(line) } : {}),
        },
        requestId: "r3",
      });
    }
    if (call.method === "GET" && p === "/ai_chat/instances") {
      const Instances = options.instances ?? [
        { InstanceID: "inst-1", Name: "Blank", Status: "ACTIVE" },
      ];
      return json(200, { Instances, Count: Instances.length });
    }
    if (
      call.method === "POST" &&
      /^\/ai_chat\/instances\/[^/]+\/sessions$/.test(p)
    ) {
      sessions += 1;
      return json(201, {
        Session: {
          id: `sess-${sessions}`,
          organizationID: "org",
          title: "LegaLinaw",
        },
      });
    }
    if (
      call.method === "POST" &&
      /^\/ai_chat\/instances\/[^/]+\/sessions\/[^/]+\/messages$/.test(p)
    ) {
      const { message } = JSON.parse(call.body as string) as {
        message: string;
      };
      const answer =
        typeof options.answer === "function"
          ? options.answer(message)
          : (options.answer ?? "{}");
      return json(200, {
        Answer: { sessionID: "x", answer, citations: [], degradedSources: [] },
      });
    }
    return json(404, { error: { code: "NOT_FOUND", message: "no route" } });
  }) as typeof fetch;

  return { fetch: doFetch, calls };
}

/** Fake credentials. Obvious placeholders; tests assert they never leak. */
export const FAKE_CONFIG: LiveLumenConfig = {
  mode: "live",
  apiKey: "test-key-SECRETKEYVALUE",
  apiSecret: "test-secret-SECRETSECRETVALUE",
  origin: "https://lumen.test",
};
