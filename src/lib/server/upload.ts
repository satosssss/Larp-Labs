import { ApiFailure } from "./api";

export type FileKind = "pdf" | "jpeg" | "png" | "heic";
export type ValidatedUpload = {
  kind: FileKind;
  mime: string;
  size: number;
  pages: number | null;
  bytes: Uint8Array;
};

export const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;
export const MAX_PDF_PAGES = Number(process.env.MAX_PDF_PAGES ?? 10);

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

/** Detects the type from magic bytes. File name and client MIME are ignored. */
export function sniff(b: Uint8Array): FileKind | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "png";
  if (startsWith(b, [0x66, 0x74, 0x79, 0x70], 4) && b.length >= 12) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (["heic", "heix", "heim", "heis", "mif1", "msf1"].includes(brand))
      return "heic";
  }
  return null;
}

/** Approximate page count by counting /Type /Page objects (not /Pages). */
export function countPdfPages(b: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(b);
  return (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
}

const MIME: Record<FileKind, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};

/** Validates an uploaded File entirely in memory. Nothing is written to disk. */
export async function validateUpload(file: unknown): Promise<ValidatedUpload> {
  if (!(file instanceof File))
    throw new ApiFailure("BAD_REQUEST", 'Send a file in the "file" field.');
  if (file.size === 0)
    throw new ApiFailure("INVALID_FILE", "The file is empty.");
  if (file.size > MAX_BYTES)
    throw new ApiFailure(
      "FILE_TOO_LARGE",
      `File exceeds ${Math.round(MAX_BYTES / 1048576)} MB.`,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind)
    throw new ApiFailure(
      "UNSUPPORTED_TYPE",
      "Only PDF, JPEG, PNG or HEIC files are supported.",
    );
  let pages: number | null = null;
  if (kind === "pdf") {
    pages = countPdfPages(bytes);
    if (pages === 0) throw new ApiFailure("INVALID_FILE", "Unreadable PDF.");
    if (pages > MAX_PDF_PAGES)
      throw new ApiFailure(
        "INVALID_FILE",
        `PDF has more than ${MAX_PDF_PAGES} pages.`,
      );
  }
  return { kind, mime: MIME[kind], size: file.size, pages, bytes };
}
