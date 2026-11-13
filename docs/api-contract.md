# LegaLinaw API contract

Same-origin Next.js route handlers under `/api`. Version: **v0.1** (2026-11-13).
Status column: **live** = implemented and tested, **stub** = validates input then returns `501 NOT_IMPLEMENTED`, **planned** = route does not exist yet.

## Envelope

Every JSON response, success or failure, has this shape:

```ts
type ApiResponse<T> =
  | { ok: true;  data: T;    error: null }
  | { ok: false; data: null; error: { code: ErrorCode; message: string; retryAfterSec?: number; details?: unknown } };
```

All responses carry `Cache-Control: no-store`. The one exception is `POST /api/report`, which returns raw `application/pdf` on success and the envelope on failure.

| code | HTTP | meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | malformed or missing input |
| `UNSUPPORTED_TYPE` | 415 | file is not PDF/JPEG/PNG/HEIC (checked by content, not name) |
| `FILE_TOO_LARGE` | 413 | over `MAX_UPLOAD_MB` (default 10) |
| `INVALID_FILE` | 422 | empty, unreadable, or PDF over `MAX_PDF_PAGES` (default 10) |
| `LOW_QUALITY` | 422 | image failed blur/darkness/size check (`details` lists reasons) |
| `NOT_FOUND` | 404 | unknown id, or not owned by this session |
| `EXPIRED` | 410 | reserved |
| `RATE_LIMITED` | 429 | see `retryAfterSec` and `Retry-After` header |
| `NOT_IMPLEMENTED` | 501 | route exists, service not connected |
| `INTERNAL` | 500 | unexpected; details are logged server-side only |

Frontend: `src/lib/gateway.ts` unwraps the envelope. It throws `ServiceUnavailable` on 501 and `ApiRequestError {code, message, retryAfterSec}` otherwise.

## Session

No login. The first write that needs ownership (`POST /api/share`) sets an httpOnly, SameSite=Strict, signed cookie `ll_session` (4 h). The server never stores document text. Refreshing the page loses the document because client state is memory-only. `DELETE /api/session` revokes the session's share links and clears the cookie.

## Routes

`language` is always `"fil" | "en"`. `text` is reviewed, redacted text, 1 to 100,000 chars. Rate limits are per client IP per route (in-memory; see Deployment notes).

| Method & path | Status | Request | `data` on success | Owner |
|---|---|---|---|---|
| `POST /api/extract` | stub | `multipart/form-data` with field `file` | `{ text: string }` | M2 (OCR), M3 (validation, quality) |
| `POST /api/analyze` | stub | `{ text, language }` | `Analysis` (`src/lib/sample.ts`) | M2 |
| `POST /api/chat` | stub | `{ text, question, language }` | `{ text: string; quote?: string }` | M2 |
| `POST /api/prepare` | stub | `{ text, language, answers: (string\|null)[] }` | `{ questions: string[]; checklist: {id,label,group}[] }` | M2 |
| `POST /api/deadline` | live | see below | see below | M3 |
| `GET /api/providers?city=` | planned | query `city` (+ optional `region`) | `Provider[]` plus map link | M3 |
| `POST /api/report` | planned | `{ analysis, questions, checked, language }` | PDF bytes | M3 |
| `POST /api/share` | live | `{ analysis, questions, checked, language }` | `{ id, url, expiresAt }` | M3 |
| `GET /api/share/[id]` | live | none | `{ language, type, dates[], nextSteps[], expiresAt }` | M3 |
| `DELETE /api/share/[id]` | live | none (owner cookie) | `{ revoked: true }` | M3 |
| `DELETE /api/session` | live | none | `{ deleted: true, sharesRevoked: number }` | M3 |
| `GET /s/[id]` (page) | live | none | renders `SharedSummary`, or "no longer available" | M3 |

### `POST /api/deadline`

The LLM must not do date math. M2 extracts the raw facts and calls this (or imports `src/lib/server/deadline.ts` directly).
Dates are `YYYY-MM-DD`, interpreted in Philippine time (UTC+8).

```jsonc
// Fixed event (hearing, conference)
{ "eventDate": "2026-11-20" }
// -> { "daysRemaining": 7, "urgency": "soon" }

// Period counted from a start date
{ "startDate": "2026-11-13", "days": 5, "dayType": "calendar" | "working", "rollForward": false, "holidays": ["2026-11-17"] }
// -> { "dueDate": "2026-11-18", "daysRemaining": 5, "urgency": "soon" }
```

`urgency`: `overdue` (<0 days), `critical` (0 to 2), `soon` (3 to 7), `upcoming` (8+). Missing or invalid event dates return `urgency: "unknown"` with `daysRemaining: null`. Invalid period input returns `BAD_REQUEST`; it is never guessed.
`rollForward` applies to calendar mode only. Working-day mode always skips weekends and listed holidays. Pass Philippine holidays in `holidays`; the server has no holiday table yet.

### `POST /api/share` privacy rule

The server keeps only `type`, `date`, `time` (as `dates[]`) and up to 10 consultation questions (300 chars each). Sender, quotes, explanations, summary and checklist state are dropped. M2: redact names and addresses from `questions` before they reach this route; the server does not detect PII.

Links expire after `SHARE_TTL_HOURS` (default 72). Only the creating session can revoke.

### `POST /api/extract` upload rules

In memory only, never written to disk. The type is detected from magic bytes. Planned additional checks: image blur, darkness and minimum size before OCR, returning `LOW_QUALITY` with `details: { reasons: ("blurry"|"dark"|"too_small")[] }`.

## For Members 1 and 2

- Replace a stub by editing only the `throw new ApiFailure("NOT_IMPLEMENTED", ...)` line in that route. Validation, rate limiting and the envelope are already there.
- Throw `ApiFailure(code, message)` for expected errors. Return `ok(data)` for success. Do not return raw `Response.json`.
- Keep secrets (Lumen keys, Supabase service role) server-side only. Never prefix them `NEXT_PUBLIC_`.
- The server never receives unredacted text for Lumen Chat: redact first, then call the model.

## Deployment notes

- The share store and rate limiter are in-memory today. On Vercel each serverless instance has its own memory, so **links will not persist reliably and limits are best-effort until the Supabase adapters replace them**. The interfaces (`ShareStore`, `rateLimit`) are the swap points.
- `SESSION_SECRET` (32+ chars) is required in production.
