import { ApiFailure, withHandler } from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";
import { validateUpload } from "@/lib/server/upload";

export const runtime = "nodejs";

/**
 * POST multipart/form-data { file } -> { text }
 * Validation is done; OCR (Lumen) is Member 2's step and is not connected yet.
 * The file is held in memory only and discarded when the request ends.
 */
export const POST = withHandler("extract", RULES.upload, async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiFailure("BAD_REQUEST", "Expected multipart/form-data.");
  }
  await validateUpload(form.get("file"));
  // TODO(Member 1/2): image quality check, HEIC conversion, OCR -> { text }.
  throw new ApiFailure("NOT_IMPLEMENTED", "Text extraction is not connected.");
});
