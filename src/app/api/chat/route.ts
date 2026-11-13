import {
  ApiFailure,
  isLanguage,
  readJson,
  requireText,
  withHandler,
} from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";

export const runtime = "nodejs";

/** POST { text, question, language } -> { text, quote? }. Lumen not connected. */
export const POST = withHandler("chat", RULES.ai, async (req) => {
  const body = await readJson(req);
  requireText(body.text);
  requireText(body.question, "question");
  if (!isLanguage(body.language))
    throw new ApiFailure("BAD_REQUEST", '"language" must be "fil" or "en".');
  throw new ApiFailure("NOT_IMPLEMENTED", "Chat is not connected.");
});
