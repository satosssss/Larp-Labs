import type { Provenance } from "../../lib/ai-types";
import { toFrontendAnalysis, toFrontendChat } from "../../lib/ai-mapper";
import type { Language } from "../../lib/sample";
import { analyzeDocument } from "./analyze";
import { answerQuestion } from "./chat";
import { AiError, toErrorBody } from "./errors";
import {
  MAX_FILE_BYTES,
  MAX_JSON_BYTES,
  MULTIPART_OVERHEAD_BYTES,
} from "./limits";
import { chatModelFromEnv } from "./gemini-client";
import {
  ocrClientFromEnv,
  type ChatModel,
  type OcrClient,
} from "./lumen-client";
import { validateUpload } from "./file-validation";
import { extractText } from "./lumen-ocr";
import { RateLimitError, RateLimiter, clientKey } from "./rate-limit";
import {
  parseAnalyzeRequest,
  parseChatRequest,
  parseLanguage,
} from "./requests";

/**
 * Framework-independent request handlers behind the /api/* route files.
 * Everything runs on the server. Privacy rules enforced here:
 *  - nothing is stored; bytes and text live only for the request;
 *  - document text, quotes, file names and credentials are never logged;
 *    failures log only the route name and an error code;
 *  - errors returned to the browser are the safe, localized messages from
 *    errors.ts, never raw upstream or internal messages.
 */

export type Deps = {
  /** OCR only. Lumen is the document reader. */
  getOcrClient: () => OcrClient;
  /** Review, explanation and follow-up chat. Gemini is the reasoner. */
  getChatModel: () => ChatModel;
  /** Applied to live (credit-costing) calls only. Mock mode is never throttled. */
  limiter?: RateLimiter;
};
const defaultDeps: Deps = {
  getOcrClient: ocrClientFromEnv,
  getChatModel: chatModelFromEnv,
  limiter: new RateLimiter(),
};

/**
 * Charges the caller's rate-limit budget for any live provider. Both providers
 * are metered, so the limit is per visitor rather than per upstream service.
 */
function limited<T extends { provenance: Provenance }>(
  request: Request,
  client: T,
  deps: Deps,
): T {
  if (client.provenance !== "mock") deps.limiter?.check(clientKey(request));
  return client;
}

/** Reported to the browser as `mode`: mock | lumen | gemini. */
const mode = (provenance: Provenance) => provenance;

function respond(body: unknown, status = 200, provenance?: Provenance) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  // Lets developers and the UI layer see at a glance when output is mock.
  if (provenance) headers["X-LegaLinaw-AI-Mode"] = mode(provenance);
  return Response.json(body, { status, headers });
}

function fail(route: string, error: unknown, language: Language) {
  const { status, body } = toErrorBody(error, language);
  console.error(`[ai] ${route} failed: ${body.error.code}`);
  const response = respond(body, status);
  if (error instanceof RateLimitError)
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
  return response;
}

async function readJson(
  request: Request,
): Promise<{ body: unknown; language: Language }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) throw new AiError("invalid_request");
  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) throw new AiError("invalid_request");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AiError("invalid_request");
  }
  const language =
    typeof body === "object" && body !== null
      ? parseLanguage((body as Record<string, unknown>).language)
      : "fil";
  return { body, language };
}

export async function handleOcr(
  request: Request,
  deps: Deps = defaultDeps,
): Promise<Response> {
  let language: Language = "fil";
  try {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES)
      throw new AiError("file_too_large");
    if (
      !(request.headers.get("content-type") ?? "").includes(
        "multipart/form-data",
      )
    )
      throw new AiError("invalid_request");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AiError("invalid_request");
    }
    language = parseLanguage(form.get("language"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new AiError("invalid_request");
    if (file.size > MAX_FILE_BYTES) throw new AiError("file_too_large");

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Validate the file before charging the caller's rate-limit budget or
    // contacting Lumen, so bad uploads cost nothing.
    const validated = validateUpload(bytes);
    const result = await extractText(
      limited(request, deps.getOcrClient(), deps),
      bytes,
      request.signal,
      validated,
    );
    return respond(
      {
        text: result.text,
        ...(result.pages ? { pages: result.pages } : {}),
        // Present only when the engine could not read some pages.
        ...(result.failedPages
          ? { incomplete: true, failedPages: result.failedPages }
          : {}),
        mode: mode(result.provenance),
      },
      200,
      result.provenance,
    );
  } catch (error) {
    return fail("ocr", error, language);
  }
}

export async function handleAnalyze(
  request: Request,
  deps: Deps = defaultDeps,
): Promise<Response> {
  let language: Language = "fil";
  try {
    const json = await readJson(request);
    language = json.language;
    const input = parseAnalyzeRequest(json.body);
    const model = limited(request, deps.getChatModel(), deps);
    const detail = await analyzeDocument(model, input, request.signal);
    const analysis = toFrontendAnalysis(detail);
    // Nothing in the result is backed by the document: do not present it.
    if (!analysis) throw new AiError("unsupported");
    return respond(
      { analysis, detail, mode: mode(detail.provenance) },
      200,
      detail.provenance,
    );
  } catch (error) {
    return fail("analyze", error, language);
  }
}

export async function handleChat(
  request: Request,
  deps: Deps = defaultDeps,
): Promise<Response> {
  let language: Language = "fil";
  try {
    const json = await readJson(request);
    language = json.language;
    const input = parseChatRequest(json.body);
    const model = limited(request, deps.getChatModel(), deps);
    const detail = await answerQuestion(model, input, request.signal);
    return respond(
      { reply: toFrontendChat(detail), detail, mode: mode(detail.provenance) },
      200,
      detail.provenance,
    );
  } catch (error) {
    return fail("chat", error, language);
  }
}
