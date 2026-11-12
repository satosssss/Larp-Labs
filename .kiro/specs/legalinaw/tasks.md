# Implementation Plan: LegaLinaw

## Overview

The implementation language is TypeScript (Next.js App Router, per the design). Work proceeds in this order: project scaffold and shared interfaces, pure logic modules in `src/core/` with their property tests, server routes and Supabase wiring, UI, and a final wiring pass.

Open decisions from the design are not resolved. Tasks that touch them stay behind an interface or a replaceable data file and carry a **Depends on open decision** note. The decisions are numbered as in the design's "Open Decisions" section:

- OD1 Lumen API shape. OD2 Name and address detection for redaction. OD3 Quote matching through redaction. OD4 Session end on tab close. OD5 Share payload and Privacy-First. OD6 Geocoding table. OD7 Provider dataset. OD8 Date ambiguity rules. OD9 Fallback AI provider (not built). OD10 PDF input to Lumen OCR.

Each correctness property from the design is its own optional test sub-task, placed right after the module it checks.

## Tasks

- [ ] 1. Project scaffold and shared contracts
  - [ ] 1.1 Scaffold the Next.js (App Router, TypeScript) project
    - Set up Vitest, fast-check, React Testing Library, and the `src/core/`, `src/app/api/`, `src/components/`, `src/i18n/` folders
    - Add `next.config.ts` headers: HSTS and security headers
    - Add `.env.example` listing server-only Lumen and Supabase variables (no `NEXT_PUBLIC_` prefix for secrets)
    - _Requirements: 24.5, 24.6, 24.7_

  - [ ] 1.2 Define shared types and the Lumen boundary
    - Create shared types: `NoticeType`, `KeyField`, `Entity`, `SessionState`, `Claim`, `Result<T>`
    - Define the `LumenClient` interface (`ocr`, `chat`) and a `FakeLumenClient` for tests; no real endpoint is bound here
    - Add `withTimeout` helper (30 000 ms default, 60 000 ms for OCR) and the typed i18n dictionary loader (`fil`/`en`, per-area files merged by key, a missing key fails the build)
    - **Depends on open decision:** OD1 (the real client is bound in task 17.3)
    - _Requirements: 3.7, 22.1, 22.2, 24.1_

- [ ] 2. Notice serialization
  - [ ] 2.1 Implement `notice-schema` (Zod schema, `serialize`, `parse`)
    - Implement the `NoticeData` schema with required and optional fields, `+08:00` date normalization, and UTF-8 output
    - Return per-field `{field, reason}` errors and no partial data
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7_

  - [ ]* 2.2 Write property test for serialization round trip
    - **Property 47: Serialization round trip**
    - **Validates: Requirements 25.2, 25.3, 25.8**

  - [ ]* 2.3 Write property test for serialized format
    - **Property 48: Serialized format**
    - **Validates: Requirements 25.7**

  - [ ]* 2.4 Write property test for parser and serializer rejection
    - **Property 49: Parser and serializer reject invalid input**
    - **Validates: Requirements 25.4, 25.5, 25.6**

- [ ] 3. Upload validation and photo quality
  - [ ] 3.1 Implement `fileValidator` and `uploadSlot`
    - Sniff magic bytes with `file-type`, check size (0 to 10,485,760 bytes) and PDF page count (at most 10), and return one rejection reason
    - Implement `applyNewFile` so only an accepted file replaces the current one
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.7, 1.8, 1.9_

  - [ ]* 3.2 Write property test for file validation by content
    - **Property 1: File validation by content**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.7, 1.8**

  - [ ]* 3.3 Write property test for the upload slot
    - **Property 2: Rejected uploads leave the slot unchanged**
    - **Validates: Requirements 1.4, 1.5, 1.9**

  - [ ] 3.4 Implement `qualityTips` and `qualityFlow`
    - Browser image analysis for blur, brightness, and cropped edges with a 5 s limit; PDFs skip the check
    - Tips per flag in Filipino and English; flow state that gates OCR on "Ituloy pa rin" or a clean result
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ]* 3.5 Write property test for quality tips
    - **Property 3: Quality tips match detected problems**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**

  - [ ]* 3.6 Write property test for the quality flow gate
    - **Property 4: Quality flow gates OCR on user choice**
    - **Validates: Requirements 2.2, 2.7, 2.8, 2.9, 2.10, 2.11**

- [ ] 4. OCR result handling and review rules
  - [ ] 4.1 Implement `confidence`, `ocrResult`, `keyFields`, and `reviewGate`
    - `normalizeConfidence` to an integer 0 to 100, `levelOf` (High, Medium, Low, absent is Low)
    - OCR result classification (no text if empty or no alphanumeric characters)
    - `needsVerification` (below 80 and not edited) and `canConfirm` (empty, whitespace, over 20,000 characters)
    - _Requirements: 3.1, 3.4, 3.6, 4.2, 4.3, 4.4, 4.6, 4.9, 9.1, 9.2, 9.4, 9.5, 9.6_

  - [ ]* 4.2 Write property test for confidence normalization
    - **Property 5: Confidence scores are integers from 0 to 100**
    - **Validates: Requirements 3.4, 4.2**

  - [ ]* 4.3 Write property test for OCR result classification
    - **Property 6: OCR result classification**
    - **Validates: Requirements 3.1, 3.6**

  - [ ]* 4.4 Write property test for low-confidence field flags
    - **Property 7: Low-confidence fields are flagged until edited**
    - **Validates: Requirements 4.3, 4.4, 9.4, 9.5**

  - [ ]* 4.5 Write property test for the review confirmation gate
    - **Property 8: Review confirmation gate**
    - **Validates: Requirements 4.6, 4.9**

- [ ] 5. Redaction
  - [ ] 5.1 Implement `entityDetector` and `redactor`
    - Regex detection for SSS, TIN, PhilSys, UMID, passport, and driver's license patterns
    - Names and addresses behind a replaceable `NameAddressDetector` interface, shipped with a rule-based default; manual mask and unmask covers misses
    - `redact` with unmasked set, `rehydrate`, and `spanMap`
    - **Depends on open decision:** OD2 (detector implementation and recall target)
    - _Requirements: 4.8, 5.2, 5.3, 5.5, 5.6_

  - [ ] 5.2 Implement the send guard for redaction failure
    - Wrap redaction so any thrown error blocks all outgoing Lumen calls and leaves the reviewed text unchanged, with a retry message
    - _Requirements: 5.3, 5.4_

  - [ ]* 5.3 Write property test for redaction and round trip
    - **Property 10: Redaction removes masked values and round-trips**
    - **Validates: Requirements 4.8, 5.2, 5.5, 5.6**

  - [ ]* 5.4 Write property test for redaction failure
    - **Property 11: Redaction failure sends nothing**
    - **Validates: Requirements 5.3, 5.4**

- [ ] 6. Session, stages, errors, and rate limiting
  - [ ] 6.1 Implement `stages` and the in-memory session store (Zustand)
    - `canEnter`, `nextStage`, and store slices for reviewed text, edits, chat, follow-ups, checklist state, and question list
    - Follow-up flow: record answer or skip, next question, prepare stage available when all are answered or skipped
    - No persistence to `localStorage`
    - _Requirements: 4.5, 18.7, 22.7, 23.1, 23.2, 23.5, 23.6, 23.7, 23.8_

  - [ ]* 6.2 Write property test for stage gating
    - **Property 42: Stage gating and step indicator**
    - **Validates: Requirements 22.7, 23.1, 23.2**

  - [ ]* 6.3 Write property test for state surviving navigation
    - **Property 9: Session state survives navigation**
    - **Validates: Requirements 4.5, 18.7, 23.8**

  - [ ]* 6.4 Write property test for the follow-up flow
    - **Property 43: Follow-up flow**
    - **Validates: Requirements 23.5, 23.6, 23.7**

  - [ ] 6.5 Implement `session` inactivity state
    - `inactivityState` returns active, warning (30 to 35 minutes), or ended; interaction during warning restarts the period
    - _Requirements: 23.9, 23.10, 23.11_

  - [ ]* 6.6 Write property test for the inactivity timeline
    - **Property 44: Inactivity timeline**
    - **Validates: Requirements 23.9, 23.10, 23.11**

  - [ ] 6.7 Implement `errors.toUserMessage`
    - Map any error to a localized plain message with no stack frames, status codes, or error codes
    - _Requirements: 22.11, 24.3, 24.4_

  - [ ]* 6.8 Write property test for user-facing messages
    - **Property 45: User-facing messages hide technical details**
    - **Validates: Requirements 22.11, 24.4**

  - [ ] 6.9 Implement `rateLimiter.check`
    - Sliding window of 10 minutes with a maximum of 20 requests, `retryAfterSeconds` rounded up, denied requests not counted
    - _Requirements: 24.8, 24.9_

  - [ ]* 6.10 Write property test for the rate limit window
    - **Property 46: Rate limit window**
    - **Validates: Requirements 24.8, 24.9**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Classification, explanation validation, and source checking
  - [ ] 8.1 Implement `classifier` and `typeContent`
    - `resolveType` (override first, below 60 is "unrecognized"), override persists for the session
    - "What is this?" content of at most 100 words per type and language, naming the issuing office except for "unrecognized"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [ ]* 8.2 Write property test for classification resolution
    - **Property 13: Classification resolution**
    - **Validates: Requirements 6.1, 6.4, 6.5**

  - [ ]* 8.3 Write property test for type card content
    - **Property 14: Type card content**
    - **Validates: Requirements 6.2, 6.3**

  - [ ] 8.4 Implement `sourceChecker`
    - `validateClaims` keeps a source only when the quote is an exact substring of the reviewed text, otherwise strips it and adds the "not stated in the document" label
    - `markOutdated` for edited text
    - Matching runs against redacted reviewed text with display mapped back through `spanMap`
    - **Depends on open decision:** OD3 (revalidation after unmasking is handled by regenerating)
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 11.4, 13.2, 14.8, 14.9_

  - [ ]* 8.5 Write property test for exact-substring sources
    - **Property 16: Sources are exact substrings**
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.5, 8.6, 11.4, 13.2, 14.8, 14.9**

  - [ ]* 8.6 Write property test for outdated source detection
    - **Property 17: Outdated source detection**
    - **Validates: Requirements 8.7**

  - [ ] 8.7 Implement the explanation Zod schema and post-processor
    - Four sections in both languages, term definitions (at most 2 sentences plus one example), consequence labels, overall and per-statement confidence markers, OCR-misread markers
    - Low overall confidence adds the consult-a-lawyer message with a Help_Finder link; appearance-type notices add the recommendation before the checklist
    - _Requirements: 7.1, 7.3, 7.4, 7.7, 7.8, 9.1, 9.2, 9.3, 9.4, 9.6, 15.6_

  - [ ]* 8.8 Write property test for explanation structure and labels
    - **Property 15: Explanation structure and labels**
    - **Validates: Requirements 7.1, 7.4, 7.7, 7.8**

  - [ ]* 8.9 Write property test for confidence level mapping
    - **Property 18: Confidence level mapping**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.6**

- [ ] 9. Deadlines
  - [ ] 9.1 Implement `deadlines`
    - `extractDeadlines` limited to dates present in the reviewed text with supporting sentence (max 5), no relative periods
    - `countdown` in UTC+8, 23:59 default time, nearest flag, urgent flag at 72 hours or less, passed state, ambiguity and confidence-below-80 hold, user corrections
    - Date parser sits behind a `DateParser` interface
    - **Depends on open decision:** OD8 (ambiguity rules, `03/04/2025` reading, Filipino month names)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

  - [ ]* 9.2 Write property test for stated-date-only extraction
    - **Property 19: Deadline extraction is limited to stated dates**
    - **Validates: Requirements 10.1, 10.8**

  - [ ]* 9.3 Write property test for countdown arithmetic
    - **Property 20: Countdown arithmetic in Philippine time**
    - **Validates: Requirements 10.2, 10.3**

  - [ ]* 9.4 Write property test for nearest deadline and urgency
    - **Property 21: Nearest deadline and urgency**
    - **Validates: Requirements 10.4, 10.5, 10.6**

  - [ ]* 9.5 Write property test for ambiguous dates and corrections
    - **Property 22: Ambiguous dates are hidden until confirmed, corrections win**
    - **Validates: Requirements 10.9, 10.10**

- [ ] 10. Scam, sender verification, and lending mode
  - [ ] 10.1 Implement `scam.riskLevel`
    - Low for none, Medium for one, High for two or more or any OTP or password request
    - _Requirements: 11.2, 11.3, 11.5, 11.6, 11.8_

  - [ ]* 10.2 Write property test for scam risk level
    - **Property 23: Scam risk level from indicators**
    - **Validates: Requirements 11.2, 11.3**

  - [ ] 10.3 Implement `senderGuide.channelsFor`
    - 1 to 5 channels per type, Provider types for "unrecognized", general instructions that work without Lumen
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6_

  - [ ]* 10.4 Write property test for verification channels
    - **Property 24: Verification channels per type**
    - **Validates: Requirements 12.3, 12.4**

  - [ ] 10.5 Implement `lending` (mode activation and `buildEvidenceSummary`)
    - Active only for "lending app collection message"; summary lists detections, dates, sender, generation date, uses "not stated" text for missing items, includes the disclaimer
    - Static SEC and NPC contact data with last-verified dates
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7, 13.8, 13.10_

  - [ ]* 10.6 Write property test for lending mode and evidence summary
    - **Property 25: Lending mode activation and evidence summary**
    - **Validates: Requirements 13.1, 13.6, 13.7, 13.10**

- [ ] 11. Guardrail and chat input
  - [ ] 11.1 Implement `guardrail.evaluate` and the shared disclaimer
    - English and Filipino phrase rules for outcome predictions and directives (plead, sign, settle, pay, ignore, skip an appearance)
    - A throw or timeout of 10 s withholds the response
    - Disclaimer text helper in both languages
    - _Requirements: 15.1, 15.2, 15.5, 15.7, 15.8, 15.9_

  - [ ]* 11.2 Write property test for the guardrail
    - **Property 28: Guardrail blocks outcome predictions and directives**
    - **Validates: Requirements 15.1, 15.2, 15.7, 15.8, 15.9**

  - [ ]* 11.3 Write property test for disclaimer and consultation recommendation
    - **Property 29: Disclaimer and consultation recommendation**
    - **Validates: Requirements 15.5, 15.6**

  - [ ] 11.4 Implement `chatInput` validation and `suggestions`
    - Accept 1 to 500 characters and keep rejected input in the field
    - 3 to 5 suggested questions per type
    - _Requirements: 14.2, 14.3, 14.5, 14.6_

  - [ ]* 11.5 Write property test for chat input validation
    - **Property 26: Chat input validation**
    - **Validates: Requirements 14.2, 14.3**

  - [ ]* 11.6 Write property test for suggested question count
    - **Property 27: Suggested question count**
    - **Validates: Requirements 14.5**

- [ ] 12. Checklist and lawyer questions
  - [ ] 12.1 Implement `checklist.buildChecklist`
    - Three groups with 1 to 10 items each, required prepare items (Notice, ID, up to 5 related documents), cost hint, forbidden-directive filter, provider item first when a deadline exists, done-state toggling
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.8_

  - [ ]* 12.2 Write property test for checklist structure
    - **Property 30: Checklist structure**
    - **Validates: Requirements 16.1, 16.2, 16.3**

  - [ ]* 12.3 Write property test for checklist filtering and ordering
    - **Property 31: Checklist filtering and ordering**
    - **Validates: Requirements 16.5, 16.6**

  - [ ]* 12.4 Write property test for checklist done state
    - **Property 32: Checklist done state**
    - **Validates: Requirements 16.4**

  - [ ] 12.5 Implement `questions` (`validateGenerated`, add, edit, remove)
    - 5 to 10 generated questions covering deadlines, documents, next steps, costs; deadline-applicability question when none stated; reject outcome or directive questions
    - Add accepts 1 to 300 characters up to 20 total; user edits survive language switch
    - _Requirements: 18.1, 18.2, 18.4, 18.5, 18.6, 18.7, 18.8, 18.10_

  - [ ]* 12.6 Write property test for question list generation rules
    - **Property 35: Question list generation rules**
    - **Validates: Requirements 18.1, 18.2, 18.8, 18.10**

  - [ ]* 12.7 Write property test for question list editing
    - **Property 36: Question list editing**
    - **Validates: Requirements 18.4, 18.5, 18.6, 18.7**

- [ ] 13. Help finder logic
  - [ ] 13.1 Implement `helpFinder` (`rankProviders`, `markRelevant`)
    - Sort by distance from device location or city center, at most 20 results, hours fallback text, nearest-area fallback of up to 10 with kilometers and PAO national contact, relevance map per Notice type
    - City-center lookup behind a `CityCenters` data interface; bundled PAO national fallback contact
    - **Depends on open decisions:** OD6 (coordinate table source), OD7 (provider data collection)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.11_

  - [ ]* 13.2 Write property test for provider ranking
    - **Property 33: Provider ranking**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.7**

  - [ ]* 13.3 Write property test for provider fallback and relevance
    - **Property 34: Provider fallback and relevance marking**
    - **Validates: Requirements 17.8, 17.9**

- [ ] 14. Report and share logic
  - [ ] 14.1 Implement `report` (`fitReport`, `renderReportPdf`)
    - `pdf-lib` with an embedded Unicode font; caps of 5 dates, 5 parties, 10 questions; exactly one page; disclaimer, PST generation date, AI statement; "not stated" lines for empty sections; placeholders under Privacy-First unless the user opts in
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.8_

  - [ ]* 14.2 Write property test for one-page report fit
    - **Property 37: Report fits one page**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.5, 19.6, 19.8**

  - [ ] 14.3 Implement `share` core (`buildSharePayload`, `newShareId`, `isExpired`)
    - Payload with type, at most 5 dates, at most 10 next steps, disclaimer; no full text or file reference; ids from at least 16 random bytes; expiry at 24 h
    - Include original values only for values the user unmasked
    - **Depends on open decision:** OD5 (unmasked values may sit in `shares` for 24 h)
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 20.6, 20.7, 20.9_

  - [ ]* 14.4 Write property test for redacted values in report and share
    - **Property 38: Report and share use redacted values**
    - **Validates: Requirements 19.4, 20.4**

  - [ ]* 14.5 Write property test for share payload and identifiers
    - **Property 39: Share payload contents and identifiers**
    - **Validates: Requirements 20.1, 20.3, 20.5, 20.6**

  - [ ]* 14.6 Write property test for expired data selection
    - **Property 12: Expired data selection**
    - **Validates: Requirements 5.12, 20.7, 20.9**

- [ ] 15. Text-to-speech logic
  - [ ] 15.1 Implement `tts` (`ttsReducer`, `pickVoice`, `rateFor`)
    - State machine for listen, pause, play, stop, speed, language, finish; disclaimer queued last; speed change re-queues from the current character boundary; voice fallback and disabled state
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10_

  - [ ]* 15.2 Write property test for the TTS state machine
    - **Property 40: TTS state machine**
    - **Validates: Requirements 21.2, 21.3, 21.4, 21.6, 21.9, 21.10**

  - [ ]* 15.3 Write property test for speeds and voice availability
    - **Property 41: TTS speeds and voice availability**
    - **Validates: Requirements 21.5, 21.7, 21.8**

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Server: Supabase, route handlers, and Lumen adapter
  - [ ] 17.1 Create Supabase migrations
    - Tables `sessions`, `uploads`, `shares`, `rate_limits`, `providers`, `national_contacts`; RLS enabled with no public policies; private `uploads` bucket
    - Seed files for providers and national contacts kept as replaceable data
    - **Depends on open decisions:** OD6, OD7 (seed content is placeholder until data is collected)
    - _Requirements: 5.7, 17.3, 17.7, 20.7, 25.1_

  - [ ] 17.2 Implement shared route infrastructure
    - Anonymous session cookie (128-bit, `HttpOnly; Secure; SameSite=Strict`), Zod input validation, Supabase service-role client (server only), rate-limit check backed by `rate_limits`, timeout wrapper, error mapping through `toUserMessage`
    - _Requirements: 24.1, 24.4, 24.7, 24.8_

  - [ ] 17.3 Implement the Lumen HTTP adapter
    - Implement `LumenClient` against the real service, selected by an env flag; fall back to `FakeLumenClient` when not configured
    - Keep prompt templates in `src/server/prompts/` with the verbatim-quote and forbidden-output rules and a JSON schema per route
    - **Depends on open decisions:** OD1 (endpoint, auth, structured output, per-field OCR confidence), OD10 (PDF handling)
    - _Requirements: 3.1, 3.3, 3.4, 7.5, 24.1_

  - [ ] 17.4 Implement upload and OCR routes
    - `POST /api/upload-url` returns a signed upload URL and records an `uploads` row with 24 h expiry
    - `POST /api/ocr` calls `lumen.ocr` with a 60 s timeout and maps errors; text is never persisted
    - **Depends on open decisions:** OD1, OD10
    - _Requirements: 1.1, 3.1, 3.5, 3.7, 5.12_

  - [ ] 17.5 Implement analysis routes
    - `POST /api/classify`, `/api/explain`, `/api/scam`, `/api/lending`, `/api/chat`, `/api/checklist`, `/api/questions`
    - Each parses Lumen output against its Zod schema, then runs `sourceChecker`, `guardrail`, `riskLevel`, `buildChecklist`, or `validateGenerated`; failed validation returns a failed-section result with no partial content
    - Chat rejects input outside 1 to 500 characters; declined advice requests return general information with a Help_Finder link
    - **Depends on open decisions:** OD1, OD3
    - _Requirements: 6.1, 7.1, 7.9, 8.5, 11.1, 13.2, 13.3, 14.4, 14.7, 14.8, 14.9, 15.3, 15.4, 15.7, 16.1, 18.1_

  - [ ] 17.6 Implement `GET /api/providers`
    - Query by province and city, or by coordinates, from `providers`; return `national_contacts` for the PAO fallback
    - **Depends on open decisions:** OD6, OD7
    - _Requirements: 17.1, 17.2, 17.3, 17.8, 17.11_

  - [ ] 17.7 Implement the share routes and shared page
    - `POST /api/share`, `DELETE /api/share/[id]`, and the server-rendered `/s/[id]` page showing the redacted summary, or the "no longer available" state
    - Page renders at 360 px width and up with no login
    - **Depends on open decision:** OD5
    - _Requirements: 20.1, 20.2, 20.3, 20.5, 20.7, 20.8, 20.9, 20.10, 20.11_

  - [ ] 17.8 Implement data deletion and the sweeper
    - `DELETE /api/session` removes storage objects, rows, and shares with 3 automatic retries at 10 s; also accepts `sendBeacon` calls
    - `GET /api/cron/sweep` deletes rows and objects past `expires_at`; add `vercel.json` cron every minute and a server-side idle timeout on `last_active_at`
    - **Depends on open decision:** OD4 (abrupt tab close is best effort; the sweeper is the backstop)
    - _Requirements: 5.9, 5.10, 5.11, 5.12, 20.8_

- [ ] 18. UI
  - [ ] 18.1 Build the app shell and global controls
    - `StepIndicator`, `LanguageSwitch`, `TextSizeControl` (100, 150, 200 percent), `DisclaimerBanner`, pre-upload privacy and session-loss notices, Filipino as the default language, 16 px minimum body text, accessible tokens (contrast checked in a unit test)
    - _Requirements: 5.1, 5.7, 5.8, 15.5, 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9_

  - [ ] 18.2 Build upload and quality UI
    - `UploadPanel` with file picker, camera capture where available, HEIC preview via `heic2any`, PDF first-page preview, signed upload to Supabase Storage, `QualityPrompt` with "Subukan ulit" and "Ituloy pa rin"
    - OCR progress indicator within 1 s, OCR error, no-text, timeout, and three-failure messages
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.11, 3.2, 3.5, 3.6, 3.7, 3.8_

  - [ ] 18.3 Build the `ReviewScreen`
    - Image beside editable text, confidence percentages and low-confidence highlights, redaction toggles with redacted preview updating within 1 s, "Tama ang text" gating, 20,000-character message
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.2, 5.5_

  - [ ] 18.4 Build the confirmation fan-out and `ExplanationView`
    - On confirm: run the redactor, then call classify, explain, and scam in parallel and compute deadlines in the browser; each section has its own loading, error, and retry state
    - "What is this?" card, manual type selection and regeneration, term popovers, source-link highlighting, confidence badge, uncertainty markers, consequences with labels, both-language caching for instant switch, regeneration after unmasking or text edits
    - **Depends on open decision:** OD3
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.2, 7.6, 7.10, 8.2, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 22.10, 23.3, 23.4_

  - [ ] 18.5 Build deadline, scam, sender guide, and lending panels
    - `DeadlinePanel` with countdown refreshed every 60 s, confirm or correct prompt, urgent and passed states
    - `ScamPanel` with risk level, indicators, and verify-guide link; Sender_Verification_Guide page that works without Lumen
    - `LendingPanel` with detections, SEC and NPC contacts, evidence guide, and evidence summary download
    - _Requirements: 10.2, 10.5, 10.6, 10.7, 10.9, 10.10, 11.5, 11.6, 11.7, 11.8, 11.9, 12.1, 12.2, 12.5, 12.6, 13.3, 13.5, 13.6, 13.8, 13.9, 13.10_

  - [ ] 18.6 Build `ChatPanel` and the follow-up question flow
    - Suggested questions, typing indicator with submission disabled while generating, timeout and error retry, guardrail withheld message with Help_Finder link, general-information labels
    - Follow-up prompts ("responded to the Notice", "related documents") with answer and skip
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.10, 14.11, 14.12, 15.3, 15.8, 15.9, 23.5, 23.6_

  - [ ] 18.7 Build the legal help preparation stage
    - `ChecklistPanel`, `HelpFinder` (province and city selectors, optional geolocation with 10 s limit, PAO indigency information), `QuestionList` with add, edit, and remove, "Download report" with 10 s limit and retry, "Share with Family" with PST expiry shown before copy, "Stop sharing"
    - **Depends on open decisions:** OD5, OD6, OD7
    - _Requirements: 16.4, 16.7, 17.1, 17.2, 17.6, 17.10, 17.11, 18.3, 18.9, 19.1, 19.7, 19.9, 20.1, 20.2, 20.8, 20.10_

  - [ ] 18.8 Build `TtsControls`
    - Listen, pause, play, stop, three speeds, language change handling, voice-unavailable messages
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10_

  - [ ] 18.9 Build session safety UI
    - `SessionWarningDialog` with download-summary action, "Delete my data" with confirmation and retry, `pagehide` `sendBeacon`, global error boundary with plain message and retry, rate-limit message with seconds remaining
    - **Depends on open decision:** OD4
    - _Requirements: 5.9, 5.10, 5.11, 23.9, 23.10, 23.11, 24.3, 24.8, 24.9_

  - [ ] 18.10 Wire all stages together
    - Compose the five stage pages with `canEnter` gating and back navigation that retains state, connect the summary download to `serialize`, and make sure no component reads server-only keys
    - _Requirements: 22.7, 23.1, 23.2, 23.7, 23.8, 25.2_

- [ ] 19. Integration, accessibility, and smoke tests
  - [ ]* 19.1 Write integration tests with a mock Lumen server (MSW) and a local Supabase stack
    - Request shapes for OCR and chat, browser-to-API payloads contain only redacted text, deletion within 60 s for "Delete my data" and session end, the sweeper and share lifecycle, cron route
    - _Requirements: 5.3, 5.9, 5.11, 5.12, 20.7, 20.8_

  - [ ]* 19.2 Write accessibility and responsive tests (Playwright with axe-core)
    - Each stage at 360 px and 1920 px, no horizontal scroll, text sizes 100, 150, 200 percent, keyboard-only walkthrough with visible focus
    - _Requirements: 22.3, 22.4, 22.5, 22.6, 22.8, 22.9_

  - [ ]* 19.3 Write smoke tests
    - Privacy-First on by default, HTTPS redirect and HSTS header, no Lumen or Supabase service keys in `.next/static`, schema tables exist
    - _Requirements: 5.1, 24.5, 24.6, 24.7, 25.1_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Every correctness property (1 to 49) has exactly one property test sub-task using fast-check with at least 100 runs and the tag `Feature: legalinaw, Property {n}: {text}`.
- All Lumen access goes through `LumenClient`. Until OD1 is resolved, routes and tests run against `FakeLumenClient`.
- Provider, city-center, and national-contact data are replaceable data files (OD6, OD7). The ranking logic does not depend on their final content.
- OD9 (a fallback AI provider) is not built. `LumenClient` can host a second adapter later.
- Model quality checks for Filipino naturalness (Req 7.3, 7.5, 14.4, 14.7) and manual screen reader passes are manual reviews and are not coding tasks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "3.4", "4.1", "5.1", "6.1", "6.5", "6.7", "6.9", "8.1", "8.4", "9.1", "10.1", "10.3", "10.5", "11.1", "11.4", "12.1", "12.5", "13.1", "14.1", "14.3", "15.1", "17.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "3.5", "3.6", "4.2", "4.3", "4.4", "4.5", "5.2", "5.3", "6.2", "6.3", "6.4", "6.6", "6.8", "6.10", "8.2", "8.3", "8.5", "8.6", "8.7", "9.2", "9.3", "9.4", "9.5", "10.2", "10.4", "10.6", "11.2", "11.3", "11.5", "11.6", "12.2", "12.3", "12.4", "12.6", "12.7", "13.2", "13.3", "14.2", "14.4", "14.5", "14.6", "15.2", "15.3", "17.2", "17.3"] },
    { "id": 4, "tasks": ["5.4", "8.8", "8.9", "17.4", "17.5", "17.6", "17.7", "17.8", "18.1"] },
    { "id": 5, "tasks": ["18.2", "18.3", "18.4"] },
    { "id": 6, "tasks": ["18.5", "18.6", "18.7", "18.8", "18.9"] },
    { "id": 7, "tasks": ["18.10"] },
    { "id": 8, "tasks": ["19.1", "19.2", "19.3"] }
  ]
}
```
