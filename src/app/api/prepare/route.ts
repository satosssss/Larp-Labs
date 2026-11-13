import {
  ApiFailure,
  isLanguage,
  readJson,
  requireText,
  withHandler,
} from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";

export const runtime = "nodejs";

/** POST { text, language, answers } -> { questions, checklist }. Not connected. */
export const POST = withHandler("prepare", RULES.ai, async (req) => {
  const body = await readJson(req);
  requireText(body.text);
  if (!isLanguage(body.language))
    throw new ApiFailure("BAD_REQUEST", '"language" must be "fil" or "en".');
  if (!Array.isArray(body.answers) || body.answers.length > 10)
    throw new ApiFailure("BAD_REQUEST", '"answers" must be an array.');
  throw new ApiFailure("NOT_IMPLEMENTED", "Preparation is not connected.");
});
