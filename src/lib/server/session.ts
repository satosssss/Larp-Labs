import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Anonymous session: a signed random id in an httpOnly cookie. No login and no
 * document data on the server. The id only scopes share-link ownership and
 * "delete my data". Frontend state is memory-only, so a refresh loses the
 * document; the server never tries to restore it.
 */
export const SESSION_COOKIE = "ll_session";
const MAX_AGE_SEC = 60 * 60 * 4;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET (>=32 chars) is required in production");
  return "dev-only-secret-dev-only-secret-0000";
}
const sign = (id: string) =>
  createHmac("sha256", secret()).update(id).digest("base64url");

export const newSessionId = () => randomBytes(16).toString("base64url");

export function sessionFromRequest(req: NextRequest): string | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function sessionCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SEC}${secure}`;
}

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

/** Returns the session id and a Set-Cookie header when one was newly issued. */
export function ensureSession(req: NextRequest): {
  id: string;
  headers: Record<string, string>;
} {
  const existing = sessionFromRequest(req);
  if (existing) return { id: existing, headers: {} };
  const id = newSessionId();
  return { id, headers: { "Set-Cookie": sessionCookie(id) } };
}
