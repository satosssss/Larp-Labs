import { AiError } from "./errors";
import { validateUpload, type ValidatedFile } from "./file-validation";
import { OCR_TIMEOUT_MS } from "./limits";
import { withTimeout } from "./call";
import type { OcrClient, OcrPage } from "./lumen-client";

export type OcrResult = {
  text: string;
  pages?: OcrPage[];
  /** Pages the engine could not read. The text is then incomplete. */
  failedPages?: number[];
  provenance: OcrClient["provenance"];
};

/**
 * Validates the file by content, runs OCR and checks the result. The text is
 * returned unmodified so the user can review and correct it. Nothing is
 * stored or logged here.
 */
export async function extractText(
  client: OcrClient,
  bytes: Uint8Array,
  signal?: AbortSignal,
  /** Pass the result of an earlier validateUpload to avoid validating twice. */
  validated: ValidatedFile = validateUpload(bytes),
): Promise<OcrResult> {
  const { mime } = validated;
  const out = await withTimeout(
    OCR_TIMEOUT_MS,
    (s) => client.ocr({ bytes, mime, signal: s }),
    signal,
  );
  if (typeof out?.text !== "string") throw new AiError("invalid_model_output");
  // Empty, or nothing letter- or digit-like, counts as "no text" (Req 3.6).
  if (!/[\p{L}\p{N}]/u.test(out.text)) throw new AiError("no_text");
  const pages = Array.isArray(out.pages)
    ? out.pages.filter(
        (p) => Number.isInteger(p?.page) && typeof p?.text === "string",
      )
    : undefined;
  const failedPages = Array.isArray(out.failedPages)
    ? out.failedPages.filter((n) => Number.isInteger(n))
    : [];
  return {
    text: out.text,
    ...(pages?.length ? { pages } : {}),
    ...(failedPages.length ? { failedPages } : {}),
    provenance: client.provenance,
  };
}
