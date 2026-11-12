# Frontend handoff — LegaLinaw

## What Jay's branch contains

- Responsive landing page using the approved headline, palette, Geist and supplied provisional logo (`public/brand/logo.png`).
- Five-step document flow; reviewed-text gate; editable source; exact-quote source panel; stale revision rejection; sample and real documents isolated.
- In-memory original-file retention and local image/PDF preview. Object URLs are revoked when their preview unmounts. Restart clears the original and all derived state.
- Chat UI, suggested sample questions, two answer-or-skip follow-ups, editable consultation questions, and a general preparation checklist.
- Analysis loading/error/retry and explicit language-regeneration control for future real responses; original-language results retained on regeneration failure.
- Export controls for pending, failure, returned PDF, share link, expiry, copy, and confirmed revocation. No success is simulated for disconnected services.
- Help search/result/empty/error components, official national links, verification guidance, and a shared-summary presentation component.

## Connect the backend

`src/lib/gateway.ts` is the only service seam. All methods currently reject with `ServiceUnavailable`; this is intentional. Replace these methods with same-origin API adapters after agreeing request/response payloads. No browser-to-Lumen calls or keys belong here.

| Method                                       | Frontend input/output                                      | Owner                                                                      |
| -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `extract(file, signal)`                      | File → `{ text }`                                          | San Gaspar + Oropilla; signed upload and OCR                               |
| `analyze(text, language, signal)`            | reviewed text → `Analysis`                                 | Oropilla; redaction, classification, explanations, validated source quotes |
| `chat({text, question, language}, signal)`   | reviewed context → `{text, quote?}`                        | Oropilla; guardrails and source checks                                     |
| `prepare({text, language, answers}, signal)` | context → typed questions/checklist                        | Oropilla/Acierto; adapter contract reserved for generated preparation      |
| `providers(city, signal)`                    | city → `Provider[]`                                        | Acierto + San Gaspar                                                       |
| `report(input)`                              | analysis, questions, checked item IDs, language → PDF Blob | San Gaspar                                                                 |
| `share(input)`                               | preparation → `{id,url,expiresAt}`                         | San Gaspar; redacted payload, server expiration                            |
| `revoke(id)` / `deleteSession()`             | confirmed server mutation                                  | San Gaspar                                                                 |

The bundled checklist is general consultation preparation, not AI-generated document-specific advice. `prepare` is an agreed seam to replace that generic content later; it is not currently invoked. `deleteSession` is reserved until there is a server session: current restart only clears local state. When services are enabled, update the upload and restart privacy copy, and wire confirmed server deletion before claiming server data was removed.

Backend adapters must validate input content (not just extensions), PDF page count, file size, redaction, AI response schemas, guardrails, authentication/session scope and rate limits. The frontend deliberately does not duplicate these backend guarantees. Validate source quotes against the reviewed redacted text and coordinate span mapping before replacing the current reviewed-text source view. Do not send unredacted text to Lumen Chat.

`Analysis` is a small frontend view model. Adapt the Kiro schema into this view model; do not change the backend schema merely to match the UI. Missing dates/times must remain explicitly unknown. Classification and analysis results need server validation before `acceptAnalysis` receives them. The revision check rejects stale documents; each component aborts pending requests on unmount.

## Sample mode

Fixture text and explanations live in `src/lib/sample.ts`. They are fictional and plainly labeled. Editing the sample text clears its prepared explanation and offers restoration. Only displayed suggested chat questions have prepared answers; other questions receive an explicit limitation. A real upload never falls back to fixtures. Do not pitch the sample as working Lumen integration.

## Remaining teammate-owned integration

- Actual Lumen OCR/Chat and content validation, confidence metadata, PII detection/redaction and legal guardrails.
- HEIC conversion, PDF page counting/rendering for OCR, quality assessment, signed uploads and anonymous session lifecycle.
- Location dataset, ranking/geolocation, provider content refresh, legal wording approval and AI-specific preparation generation.
- Report generation, public share persistence/route, expiry/revocation, server deletion and deployment.
- Full service error/loading integration (including rate-limit responses and per-analysis-section failures) once the actual backend schemas are available.

No Supabase resources, API routes, credentials, deployment or public hosting were created by this branch.

## Source references for help links

Checked 2026-11-13; these are reference links, not claimed partnerships:

- PAO official office directory: https://pao.gov.ph/contact-us/
- Integrated Bar of the Philippines contact page: https://www.ibp.ph/contacts
- Supreme Court legal-help overview: https://sc.judiciary.gov.ph/?p=81226

Acierto should review all general legal copy before launch. Browser speech uses device voices; voice availability varies. The footer logo stays replaceable. Readable UI tokens are in `src/app/globals.css`; all notice data is held in memory, without localStorage persistence.
