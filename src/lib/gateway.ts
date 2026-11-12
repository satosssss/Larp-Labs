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
export const gateway: NoticeGateway = {
  extract: unavailable,
  analyze: unavailable,
  chat: unavailable,
  prepare: unavailable,
  providers: unavailable,
  report: unavailable,
  share: unavailable,
  revoke: unavailable,
  deleteSession: unavailable,
};
export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
