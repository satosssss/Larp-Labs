import { expect } from "vitest";
import { AiError, type AiErrorCode } from "../../src/server/ai/errors";

export const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
export const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46,
]);

const enc = (s: string) => new TextEncoder().encode(s);
export const pdf = (pages: number, extra = "", eof = true) =>
  enc(
    `%PDF-1.4\n1 0 obj << /Type /Pages /Count ${pages} >> endobj\n` +
      Array.from(
        { length: pages },
        (_, i) => `${i + 2} 0 obj << /Type /Page >> endobj\n`,
      ).join("") +
      extra +
      (eof ? "trailer << >>\n%%EOF\n" : ""),
  );
export const textFile = enc(
  "This is just a text file pretending to be an image.",
);
/** HEIC 'ftyp' box. Not accepted yet. */
export const HEIC = new Uint8Array([
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0,
]);

/** Asserts a function throws an AiError with the given code. */
export async function expectAiError(
  run: () => unknown | Promise<unknown>,
  code: AiErrorCode,
) {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe(code);
    return;
  }
  throw new Error(`Expected AiError ${code} but nothing was thrown`);
}
