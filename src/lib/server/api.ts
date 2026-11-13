import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, type RateRule } from "./ratelimit";

export type ErrorCode =
  | "BAD_REQUEST"
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "LOW_QUALITY"
  | "NOT_FOUND"
  | "EXPIRED"
  | "RATE_LIMITED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

export type ApiError = {
  code: ErrorCode;
  message: string;
  retryAfterSec?: number;
  details?: unknown;
};
export type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ApiError };

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  INVALID_FILE: 422,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_TYPE: 415,
  LOW_QUALITY: 422,
  NOT_FOUND: 404,
  EXPIRED: 410,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

type Extra = Pick<ApiError, "retryAfterSec" | "details">;

/** Throw from anywhere inside a handler; `withHandler` converts it to the envelope. */
export class ApiFailure extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public extra: Extra = {},
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(
  data: T,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { ok: true, data, error: null },
    { status: init.status ?? 200, headers: { ...NO_STORE, ...init.headers } },
  );
}

export function fail(
  code: ErrorCode,
  message: string,
  extra: Extra = {},
  headers: Record<string, string> = {},
): NextResponse<ApiResponse<never>> {
  const h: Record<string, string> = { ...NO_STORE, ...headers };
  if (extra.retryAfterSec) h["Retry-After"] = String(extra.retryAfterSec);
  return NextResponse.json(
    { ok: false, data: null, error: { code, message, ...extra } },
    { status: STATUS[code], headers: h },
  );
}

export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route: rate limiting, error envelope, no leaking of internals. */
export function withHandler<P = Record<string, never>>(
  name: string,
  rule: RateRule,
  fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      const rl = await rateLimit(`${name}:${clientKey(req)}`, rule);
      if (!rl.allowed)
        return fail("RATE_LIMITED", "Too many requests. Try again shortly.", {
          retryAfterSec: rl.retryAfterSec,
        });
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiFailure) return fail(e.code, e.message, e.extra);
      console.error(`[api:${name}]`, e instanceof Error ? e.message : "error");
      return fail("INTERNAL", "Something went wrong.");
    }
  };
}

export async function readJson<T = Record<string, unknown>>(
  req: NextRequest,
  maxBytes = 300_000,
): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes)
    throw new ApiFailure("BAD_REQUEST", "Request body too large.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiFailure("BAD_REQUEST", "Body must be valid JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new ApiFailure("BAD_REQUEST", "Body must be a JSON object.");
  return value as T;
}

export const isLanguage = (v: unknown): v is "fil" | "en" =>
  v === "fil" || v === "en";

export const MAX_TEXT = 100_000;
export function requireText(v: unknown, field = "text"): string {
  if (typeof v !== "string" || !v.trim() || v.length > MAX_TEXT)
    throw new ApiFailure(
      "BAD_REQUEST",
      `"${field}" must be a non-empty string up to ${MAX_TEXT} characters.`,
    );
  return v;
}
