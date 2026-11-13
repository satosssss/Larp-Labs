import { ApiFailure, ok, withHandler } from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";
import { sessionFromRequest } from "@/lib/server/session";
import { shareStore } from "@/lib/server/share-store";

export const runtime = "nodejs";

type P = { id: string };

/** GET -> { type, dates, nextSteps, language, expiresAt } (public, no owner data) */
export const GET = withHandler<P>("share-get", RULES.read, async (_req, ctx) => {
  const { id } = await ctx.params;
  const rec = await shareStore.get(id);
  if (!rec) throw new ApiFailure("NOT_FOUND", "This summary is not available.");
  return ok({ ...rec.payload, expiresAt: rec.expiresAt });
});

/** DELETE -> { revoked: true }. Only the creating session may revoke. */
export const DELETE = withHandler<P>(
  "share-del",
  RULES.write,
  async (req, ctx) => {
    const { id } = await ctx.params;
    const owner = sessionFromRequest(req);
    if (!owner || !(await shareStore.revoke(id, owner)))
      throw new ApiFailure("NOT_FOUND", "Share link not found.");
    return ok({ revoked: true });
  },
);
