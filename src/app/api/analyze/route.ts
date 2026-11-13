import {
  ApiFailure,
  isLanguage,
  readJson,
  requireText,
  withHandler,
} from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";

export const runtime = "nodejs";

/** POST { text, language } -> Analysis (see src/lib/sample.ts). Lumen not connected. */
export const POST = withHandler("analyze", RULES.ai, async (req) => {
  const body = await readJson(req);
  requireText(body.text);
  if (!isLanguage(body.language))
    throw new ApiFailure("BAD_REQUEST", '"language" must be "fil" or "en".');
  // TODO(Member 2): redact, classify, explain, validate quotes, then use
  // computeDeadline/eventUrgency from lib/server/deadline for all date math.
  throw new ApiFailure("NOT_IMPLEMENTED", "Analysis is not connected.");
});
