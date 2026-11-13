import type { Language } from "../../lib/sample";

/**
 * Typed errors with safe, localized user messages. Messages never contain
 * credentials, document text, stack traces or upstream response bodies.
 */

export type AiErrorCode =
  | "invalid_request"
  | "unsupported_file"
  | "file_too_large"
  | "too_many_pages"
  | "unreadable_file"
  | "no_text"
  | "text_too_long"
  | "document_too_long"
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "upstream_denied"
  | "invalid_model_output"
  | "out_of_scope"
  | "guardrail_blocked"
  | "unsupported";

export class AiError extends Error {
  constructor(readonly code: AiErrorCode) {
    // Only the code is carried. No detail string that could hold sensitive data.
    super(code);
    this.name = "AiError";
  }
}

export const STATUS: Record<AiErrorCode, number> = {
  invalid_request: 400,
  unsupported_file: 415,
  file_too_large: 413,
  too_many_pages: 422,
  unreadable_file: 422,
  no_text: 422,
  text_too_long: 422,
  document_too_long: 422,
  not_configured: 503,
  timeout: 504,
  rate_limited: 429,
  upstream_error: 502,
  upstream_denied: 503,
  invalid_model_output: 502,
  out_of_scope: 422,
  guardrail_blocked: 422,
  unsupported: 422,
};

const UNAVAILABLE: Record<Language, string> = {
  fil: "Hindi available ang AI service ngayon. Subukan muli mamaya.",
  en: "The AI service is unavailable right now. Please try again later.",
};

const MESSAGES: Record<AiErrorCode, Record<Language, string>> = {
  invalid_request: {
    fil: "Hindi balido ang hiling. Subukan muli.",
    en: "The request was not valid. Please try again.",
  },
  unsupported_file: {
    fil: "JPG, PNG at PDF lang ang suportado. Pumili ng ibang file.",
    en: "Only JPG, PNG and PDF files are supported. Please choose a different file.",
  },
  file_too_large: {
    fil: "Hanggang 10 MB lang ang puwedeng file.",
    en: "Files can be up to 10 MB.",
  },
  too_many_pages: {
    fil: "Hanggang 10 pahina lang ang puwedeng PDF.",
    en: "PDFs can have up to 10 pages.",
  },
  unreadable_file: {
    fil: "Hindi mabasa ang file. Pumili ng ibang file.",
    en: "The file cannot be read. Please choose a different file.",
  },
  no_text: {
    fil: "Walang nakitang text sa file. Subukan muli o gumamit ng mas malinaw na larawan.",
    en: "No text was found in the file. Try again or use a clearer photo.",
  },
  text_too_long: {
    fil: "Masyadong mahaba ang text. Hanggang 20,000 karakter lang.",
    en: "The text is too long. The limit is 20,000 characters.",
  },
  document_too_long: {
    fil: "Masyadong mahaba ang text para sa AI ngayon. Paikliin sa pinakamahahalagang bahagi at subukan muli.",
    en: "The text is too long for the AI right now. Please shorten it to the key parts and try again.",
  },
  not_configured: {
    fil: "Hindi pa naka-set up ang AI service.",
    en: "The AI service is not set up yet.",
  },
  timeout: {
    fil: "Natagalan ang sagot. Subukan muli.",
    en: "The request took too long. Please try again.",
  },
  rate_limited: {
    fil: "Masyadong maraming hiling. Maghintay sandali at subukan muli.",
    en: "Too many requests. Please wait a moment and try again.",
  },
  upstream_error: UNAVAILABLE,
  upstream_denied: UNAVAILABLE,
  invalid_model_output: {
    fil: "Hindi nakumpleto ang paliwanag. Subukan muli.",
    en: "The explanation could not be completed. Please try again.",
  },
  out_of_scope: {
    fil: "Hindi masagot ng AI ang tanong na iyon. Subukang magtanong tungkol sa nilalaman ng notice, o humanap ng legal na tulong.",
    en: "The AI could not answer that question. Try asking about what the notice says, or find legal help.",
  },
  guardrail_blocked: {
    fil: "Hindi maipapakita ang sagot na ito dahil hindi nagbibigay ng legal na payo ang LegaLinaw. Humanap ng libreng legal na tulong.",
    en: "This response could not be shown because LegaLinaw does not give legal advice. Please look for free legal help.",
  },
  unsupported: {
    fil: "Walang bahagi ng dokumento na makapagpatunay sa paliwanag, kaya hindi ito ipinapakita. Suriin ang text o humanap ng tulong.",
    en: "No part of the document could back up the explanation, so it is not shown. Check the text or find help.",
  },
};

export type ErrorBody = {
  error: { code: AiErrorCode | "internal"; message: string };
};

export function toErrorBody(
  error: unknown,
  language: Language = "fil",
): { status: number; body: ErrorBody } {
  if (error instanceof AiError)
    return {
      status: STATUS[error.code],
      body: {
        error: { code: error.code, message: MESSAGES[error.code][language] },
      },
    };
  return {
    status: 500,
    body: {
      error: {
        code: "internal",
        message:
          language === "en"
            ? "Something went wrong. Please try again."
            : "May nangyaring problema. Subukan muli.",
      },
    },
  };
}
