import { describe, expect, it } from "vitest";
import { validateUpload } from "../../src/server/ai/file-validation";
import { MAX_FILE_BYTES } from "../../src/server/ai/limits";
import { HEIC, JPEG, PNG, expectAiError, pdf, textFile } from "./helpers";

describe("upload validation (by content, not by name)", () => {
  it("accepts JPEG, PNG and PDF by their bytes", () => {
    expect(validateUpload(JPEG)).toEqual({ mime: "image/jpeg", kind: "jpeg" });
    expect(validateUpload(PNG)).toEqual({ mime: "image/png", kind: "png" });
    expect(validateUpload(pdf(1))).toEqual({
      mime: "application/pdf",
      kind: "pdf",
    });
  });
  it("rejects a text file that only pretends to be an image", async () => {
    await expectAiError(() => validateUpload(textFile), "unsupported_file");
  });
  it("rejects HEIC for now (the frontend does not accept it yet)", async () => {
    await expectAiError(() => validateUpload(HEIC), "unsupported_file");
  });
  it("rejects an empty file as unreadable", async () => {
    await expectAiError(
      () => validateUpload(new Uint8Array()),
      "unreadable_file",
    );
  });
  it("enforces the 10 MB limit exactly", async () => {
    const atLimit = new Uint8Array(MAX_FILE_BYTES);
    atLimit.set(JPEG);
    expect(validateUpload(atLimit).kind).toBe("jpeg");
    const over = new Uint8Array(MAX_FILE_BYTES + 1);
    over.set(JPEG);
    await expectAiError(() => validateUpload(over), "file_too_large");
  });
  it("rejects password-protected and truncated PDFs as unreadable", async () => {
    await expectAiError(
      () => validateUpload(pdf(1, "/Encrypt 5 0 R\n")),
      "unreadable_file",
    );
    await expectAiError(
      () => validateUpload(pdf(1, "", false)),
      "unreadable_file",
    );
  });
  it("allows 10 PDF pages and rejects 11 (best-effort count)", async () => {
    expect(validateUpload(pdf(10)).kind).toBe("pdf");
    await expectAiError(() => validateUpload(pdf(11)), "too_many_pages");
  });
  it("does not count the /Pages tree node as a page", () => {
    expect(validateUpload(pdf(1)).kind).toBe("pdf");
  });
});
