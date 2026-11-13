import { ok, withHandler } from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";
import { clearSessionCookie, sessionFromRequest } from "@/lib/server/session";
import { shareStore } from "@/lib/server/share-store";

export const runtime = "nodejs";

/**
 * DELETE -> { deleted: true, sharesRevoked }
 * Revokes every share link created in this session and clears the cookie.
 * The server holds no document text, so there is nothing else to remove.
 */
export const DELETE = withHandler("session-del", RULES.write, async (req) => {
  const owner = sessionFromRequest(req);
  const sharesRevoked = owner ? await shareStore.revokeAll(owner) : 0;
  return ok(
    { deleted: true, sharesRevoked },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
});
