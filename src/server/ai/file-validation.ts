import { AiError } from "./errors";
import { MAX_FILE_BYTES, MAX_PDF_PAGES } from "./limits";
import type { AcceptedMime } from "./lumen-client";

/**
 * Validates an upload by its bytes, never by name or the browser-reported
 * type. Pure and in-memory. HEIC is not accepted yet because the frontend
 * does not accept it either ("HEIC support is pending").
 *
 * PDF page counting and password detection are best effort without a PDF
 * parser: they read the raw object markers. PDFs that store their page tree
 * in compressed object streams cannot be counted this way. Use a real PDF
 * library (the design names pdf-lib) before relying on the page limit.
 */

export type ValidatedFile = {
  mime: AcceptedMime;
  kind: "jpeg" | "png" | "pdf";
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

const latin1 = (bytes: Uint8Array) => {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return out;
};

export function validateUpload(bytes: Uint8Array): ValidatedFile {
  if (bytes.length === 0) throw new AiError("unreadable_file");
  if (bytes.length > MAX_FILE_BYTES) throw new AiError("file_too_large");

  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { mime: "image/jpeg", kind: "jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", kind: "png" };

  // PDF header may be preceded by a little junk, but must be near the start.
  const head = latin1(bytes.subarray(0, 1024));
  if (head.includes("%PDF-")) {
    const raw = latin1(bytes);
    if (/\/Encrypt\b/.test(raw)) throw new AiError("unreadable_file");
    // A PDF without an end-of-file marker is truncated or damaged.
    if (
      !latin1(bytes.subarray(Math.max(0, bytes.length - 2048))).includes(
        "%%EOF",
      )
    )
      throw new AiError("unreadable_file");
    const pages = raw.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;
    if (pages > MAX_PDF_PAGES) throw new AiError("too_many_pages");
    return { mime: "application/pdf", kind: "pdf" };
  }
  throw new AiError("unsupported_file");
}
