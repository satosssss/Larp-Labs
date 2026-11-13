import {
  ApiFailure,
  isLanguage,
  ok,
  readJson,
  withHandler,
} from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";
import { ensureSession } from "@/lib/server/session";
import {
  SHARE_TTL_HOURS,
  shareStore,
  type SharedSummary,
} from "@/lib/server/share-store";

export const runtime = "nodejs";

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * POST { analysis, questions, checked, language } -> { id, url, expiresAt }
 * Stores only: document type, date/time, and the consultation questions.
 * Sender, quotes, explanations and anything else are dropped here, server-side.
 */
export const POST = withHandler("share", RULES.write, async (req) => {
  const b = await readJson<Record<string, unknown>>(req, 50_000);
  if (!isLanguage(b.language))
    throw new ApiFailure("BAD_REQUEST", '"language" must be "fil" or "en".');
  const a = b.analysis as Record<string, unknown> | null;
  if (!a || typeof a !== "object")
    throw new ApiFailure("BAD_REQUEST", '"analysis" is required.');
  const type = clip(a.type, 120);
  if (!type) throw new ApiFailure("BAD_REQUEST", '"analysis.type" is required.');

  const dates = [clip(a.date, 80), clip(a.time, 80)].filter(Boolean);
  const nextSteps = Array.isArray(b.questions)
    ? b.questions
        .map((q) => clip(q, 300))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const payload: SharedSummary = {
    language: b.language,
    type,
    dates,
    nextSteps,
  };

  const { id: owner, headers } = ensureSession(req);
  const rec = await shareStore.create(owner, payload, SHARE_TTL_HOURS);
  const url = `${req.nextUrl.origin}/s/${rec.id}`;
  return ok({ id: rec.id, url, expiresAt: rec.expiresAt }, { headers });
});
