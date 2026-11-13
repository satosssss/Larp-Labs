import { aiGateway } from "./gateway-http";
import type { Analysis, Language } from "./sample";
export type ChatResult = { text: string; quote?: string };
export type Provider = {
  id: string;
  name: string;
  address: string;
  type: string;
  url: string;
  hours?: string;
  lastVerified: string;
};
export type Preparation = {
  questions: string[];
  checklist: { id: string; label: string; group: string }[];
};
export type ReportInput = {
  analysis: Analysis | null;
  questions: string[];
  checked: string[];
  language: Language;
};
export type ShareLink = { id: string; url: string; expiresAt: string };
/** Frontend integration seam only. Backend owners implement same-origin adapters.
 * Adapters must redact reviewed text, validate responses and enforce guardrails.
 * Never put Lumen credentials or Supabase service-role keys in this module. */
export interface NoticeGateway {
  extract(file: File, signal?: AbortSignal): Promise<{ text: string }>;
  analyze(
    text: string,
    language: Language,
    signal?: AbortSignal,
  ): Promise<Analysis>;
  chat(
    input: { text: string; question: string; language: Language },
    signal?: AbortSignal,
  ): Promise<ChatResult>;
  prepare(
    input: { text: string; language: Language; answers: (string | null)[] },
    signal?: AbortSignal,
  ): Promise<Preparation>;
  providers(city: string, signal?: AbortSignal): Promise<Provider[]>;
  report(input: ReportInput): Promise<Blob>;
  share(input: ReportInput): Promise<ShareLink>;
  revoke(id: string): Promise<void>;
  deleteSession(): Promise<void>;
}
export class ServiceUnavailable extends Error {
  constructor() {
    super("Service not connected");
    this.name = "ServiceUnavailable";
  }
}
const unavailable = async (): Promise<never> => {
  throw new ServiceUnavailable();
};

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Same-origin call that unwraps the `{ ok, data, error }` envelope used by the
 * backend routes (share, session, prepare). The AI routes (ocr, analyze, chat)
 * keep their own response shape and are handled by `aiGateway`. */
async function call<T>(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    signal,
    credentials: "same-origin",
  });
  let body: {
    ok?: boolean;
    data?: T;
    error?: { code: string; message: string; retryAfterSec?: number };
  } | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (res.ok && body?.ok) return body.data as T;
  if (res.status === 501 || body?.error?.code === "NOT_IMPLEMENTED")
    throw new ServiceUnavailable();
  throw new ApiRequestError(
    body?.error?.code ?? "INTERNAL",
    body?.error?.message ?? "Request failed",
    body?.error?.retryAfterSec,
  );
}

const json = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});

export const gateway: NoticeGateway = {
  extract: aiGateway.extract,
  analyze: aiGateway.analyze,
  chat: aiGateway.chat,
  prepare: (input, signal) => call("/api/prepare", json(input), signal),
  providers: unavailable, // pending Supabase directory
  report: unavailable, // pending PDF export
  share: (input) => call("/api/share", json(input)),
  revoke: async (id) => {
    await call(`/api/share/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  deleteSession: async () => {
    await call("/api/session", { method: "DELETE" });
  },
};
export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
