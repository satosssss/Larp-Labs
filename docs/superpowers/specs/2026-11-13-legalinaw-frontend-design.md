# LegaLinaw frontend design — for Jay's review

Date: 2026-11-13
Status: Approved by Jay on 2026-11-13; headline updated on approval
Scope: Jay's frontend and UI/UX work in the existing Larp-Labs repository. Local development and preview; deployment belongs to San Gaspar.

## Intent

Help Filipino adults move from a confusing notice to reviewed text, an understandable explanation, and preparation for human legal help. The interface should feel calm, readable, and approachable on a phone. It should make the next action obvious and show where explanations come from.

The user supplied a provisional scales-and-laurel logo, a four-color palette, Geist as the preferred font, and a minimalist studio landing-page reference. These are the visual inputs. Existing Kiro requirements/design/tasks remain the functional reference; unresolved backend assumptions remain unresolved rather than becoming frontend promises.

## Agreed direction and alternatives

1. Landing page followed by the five-step flow: a short introduction establishes purpose and leads into document upload. This adds one navigation step but matches the supplied reference and gives new users context.
2. Direct upload opening followed by the same flow: fewer steps, but less room to explain the service and introduce its identity.

Jay selected option 1: landing page plus guided flow, with design review before building.

## Visual system

| Token | Value | Application |
| --- | --- | --- |
| Ink | #18324B | Headings, body text, icons, strong outlines |
| Action | #147D73 | Primary buttons, active navigation, accent words |
| Soft surface | #E5F3EF | Selected areas, supporting panels, gentle emphasis |
| Canvas | #F8FAF9 | Main background and text on primary buttons |

Use Geist Sans throughout with system sans-serif fallback. Body text starts at 16 px, preferably 18 px for explanatory text, with line-height around 1.6. Headings have deliberate weight and tight but readable spacing; the landing headline scales approximately 36–64 px. Keep paragraphs around 60–70 characters wide.

Calculated contrast: navy/canvas 12.55:1; teal/canvas 4.76:1; navy/mint 11.52:1. Teal/mint is 4.37:1, so use navy for normal-sized text on mint. Navy/teal is only 2.64:1; primary buttons use canvas text. Subtle dividers can be decorative, while essential input boundaries and focus indicators use sufficiently strong colors.

Favor generous whitespace, fine rules, restrained shadows, 12–16 px card corners, and approximately 44 px or larger interaction targets. Use concise line icons with visible labels for unfamiliar actions. Avoid repeating large bordered cards around every paragraph.

Keep the supplied logo asset replaceable. Use a compact typographic LegaLinaw wordmark in the navigation, and the full supplied artwork in a larger brand placement such as the footer. Preserve the original artwork; do not recreate the emblem or turn it into an official-looking verification seal. The font of the supplied image itself is unchanged.

## Landing page

Use the reference's centered headline, thin framing lines, quiet navigation, and visual depth. Replace the reference's portfolio thumbnails with an illustrative view of LegaLinaw's own document experience.

- Header: wordmark, How it works / Paano gamitin, Legal help / Legal na tulong, language switch, and primary start action. Collapse appropriately on mobile without hiding the primary action.
- Hero eyebrow: a plain description such as “Gabay sa pag-unawa ng dokumento.”
- Headline: “Palinawin natin ang legal notice mo.”
- Supporting copy: explain upload, checking extracted text, and plain-language explanations in two short sentences.
- Primary action: “Unawain ang dokumento” leads to upload.
- Secondary action: “Subukan ang halimbawa” enters an explicitly labeled fictional sample journey.
- Visual: a large illustrative document and explanation composition, with one selected sentence and its explanation. Label it “Halimbawa” and avoid fabricated real case details, testimonials, usage numbers, or partner endorsements.
- How it works: three concise summaries — upload; review; understand and prepare. The application itself still follows five steps.
- Trust/context strip: the role of user review, Filipino/English support, and consultation preparation. Any data-handling description must match the actual backend behavior.
- Footer: full provisional logo at a readable size, brief purpose, legal-information disclaimer, and helpful navigation.

The visual preview is decorative on the landing page; the sample button opens the accessible interactive equivalent. Mobile reduces the preview to a simple vertical composition. Motion is subtle and respects reduced-motion preferences.

## Routes and application shell

Proposed routes: `/` for landing, `/notice` for the guided experience, `/help` for direct access to help information, and `/verify` for the sender-verification guide. The shared-summary presentation can be supplied as a component for San Gaspar's `/s/[id]` route; Jay does not implement its server lifecycle.

The application header is compact and keeps language, text size, and help reachable. A five-step indicator shows Upload, Review, Explanation, Questions, and Preparation. Completed steps are revisitable. On narrow screens use current step name and “Step X of 5” with an accessible progress list.

Use the Kiro design's in-memory state approach when wiring the frontend. No login or saved-history dashboard. Keep a clear start-over action with confirmation when it would discard current progress.

Help and verification routes remain reachable even when OCR or analysis is unavailable; they are not blocked by the main wizard's stage gating.

## Screen 1 — Upload

A focused upload area with drag-and-drop, a keyboard-operable file button, supported-format/size guidance, and image/PDF preview. Camera capture is a progressive enhancement.

Display a concise, accurate data-use explanation before sending a document. Show file name, size, replacement/removal actions, loading status, retry, and rejection states. The Kiro specs request JPEG, PNG, HEIC, PDF, 10 MB, and at most 10 PDF pages; real support depends on preview and backend capabilities. Do not advertise support as complete until it works.

Quality warnings are rendered when the integration supplies them. The frontend must not claim it assessed blur, brightness, or cropping merely because a file was selected.

## Screen 2 — Review

Desktop uses original document on the left and editable extracted text on the right. Mobile stacks them with an easy preview toggle; both remain available, and users can read/edit without squeezing two columns into 360 px.

Show extracted key fields requiring review and a redacted-text preview when available. Redaction detections and span mappings come through the agreed integration interface. Only display real confidence values supplied by the integration; absence is shown as unavailable or needing review, never replaced by an invented percentage.

Primary action: “Tama ang text — ipaliwanag.” Disable confirmation for empty or over-limit text. Preserve edits on back navigation. Any later text change marks downstream explanation/chat/preparation outdated and requires regeneration. Clear old data when changing documents. Ignore stale responses from the previous document or text revision.

## Screen 3 — Explanation

Lead with the possible notice type and a short plain-language explanation. Use progressive disclosure for details such as sender, requests, terms, and dates. Each date displays exactly what is known; missing time is explicit.

On desktop, the explanation sits beside a source panel. Clicking a supporting quotation opens and highlights its exact passage in the reviewed text. On mobile, open the source in an accessible drawer or inline panel with a clear close/back action. Never claim a quotation's presence proves an interpretation is correct.

Separate loading/error/retry states for explanation, document type, dates, and verification indicators. Present verification results as details to check, not an authentication badge. Lending-related panels appear only when the relevant analysis is available. General information and document-derived statements are visibly distinguished.

Display read-aloud controls, language switching, a concise legal-information disclaimer, and the next-step action. All audio behavior is browser-side and must handle unavailable voices.

## Screen 4 — Questions

Document chat uses an uncluttered conversation area, suggested prompts, a labeled input, and loading/retry states. Supporting quotations use the same source interaction as the explanation screen. The backend owns generated answers and guardrail decisions.

The two guided follow-ups from the Kiro spec ask whether the user has responded and whether related documents exist. Users can answer or skip each; skipping does not block progress. Clearly distinguish these preparation questions from free-form document chat.

Prevent duplicate sends while a response is pending, preserve input on failure, and announce new responses accessibly without taking keyboard focus away from the user.

## Screen 5 — Preparation

Use sections for the action checklist, reviewed help information, and editable questions for a lawyer. Desktop can use a wider main column with help as a side column; mobile stacks sections.

- Checklist: check/uncheck items with state preserved during this visit.
- Help: location filters, provider cards, official links, last-verified information, loading/empty/error states, and optional location permission initiated by the user. Data and relevance rules belong to Acierto/backend integration.
- Questions: add, edit, remove; respect configured length/count limits and preserve user edits on language changes.
- Download: invoke San Gaspar's report-generation interface and show pending/error/success states. Do not present a text file as a generated PDF.
- Sharing: reusable controls for backend-provided share URL, expiry, copy, stop-sharing, expired, and unavailable states. A working public share service belongs to San Gaspar; frontend previews label simulated examples.

## Scope boundaries and integration

Jay owns layout, visual components, interactions, frontend state, accessible rendering, and calls to agreed backend interfaces. Oropilla owns OCR/chat integration, prompts, classifications, source-matching decisions, and related AI results. San Gaspar owns API routes, signed uploads, sessions, PDF generation, storage, credentials, and deployment. Acierto owns reviewed legal copy/data, guardrail policy, and QA feedback.

Define a typed frontend gateway for upload/OCR, analysis, chat, help/preparation, report, share, and deletion. Final route payloads must be agreed with the backend team; do not create competing server implementations to make previews appear complete.

Since the repository currently contains specs only, a minimal Next.js/TypeScript frontend scaffold will be needed to render and review Jay's work. Coordinate its shared configuration with San Gaspar. Keep changes on a frontend branch, and preserve the existing Kiro specs. The scaffold does not provision Supabase or deploy the site.

Use explicit sample mode for functional frontend review. The fictional sample has its own fixture data and a persistent sample label; it never presents real user uploads as analyzed. Selecting a user's own file switches to the real integration path. Until the service is connected, show a truthful unavailable state. Treat mock OCR, explanation, and chat as fixtures, not Lumen usage.

Sample behavior (proposed implementation choice): provide scripted answers only for the displayed suggested questions. A free-form question without a fixture gets an explicit sample limitation message, not a fabricated answer. Editing sample source text invalidates its prepared analysis; explain that this sample cannot regenerate and offer to restore the original example. Never show the original explanation as if it describes edited text.

Language behavior (proposed implementation choice): switching languages immediately changes interface labels. Existing generated results retain their original language label until the user requests regeneration in the chosen language; while regeneration runs, show its status and guard against stale responses. Preserve chat history in the language in which each message was written; new questions request responses in the currently selected language. Preserve user-edited questions and checklists; do not silently translate or overwrite them. The sample can switch between paired, prewritten Filipino/English results for its unchanged source.

## Important spec reconciliations

These are proposed frontend interpretations for approval, not silent edits to the team specifications:

1. Replace the requirement for simultaneous side-by-side panes at 360 px with stacked/toggleable mobile content to preserve readability and text enlargement.
2. Show uncertainty without fabricated numeric confidence when provider confidence is unavailable.
3. Privacy copy distinguishes uploading the original to OCR from masking text before subsequent analysis. Do not promise no external exposure of the original file.
4. Avoid displaying a precise end-of-day countdown when the document has no time; show the stated date and request time verification. Backend date rules need reconciliation with the current 23:59 assumption.
5. Keep help directly accessible even when an earlier wizard stage fails.
6. Show backend success only after it is confirmed, including deletion and revocation. Clearing browser state is not proof of deletion from storage.

## Verification and definition of done

- The landing page and five steps render coherently on desktop and a 360 px mobile viewport.
- All four brand colors and Geist are applied through reusable tokens; the supplied logo remains replaceable.
- The sample journey works end to end with an obvious fictional-data label.
- Real-file selection does not produce fake extraction or analysis.
- Loading, empty, error, retry, partial-result, and unavailable states are represented.
- Keyboard users can complete the flow; focus is visible; dialogs manage focus and Escape; form controls have labels; source highlighting is conveyed through text as well as color.
- Text enlargement and reduced motion are supported without hiding essential actions.
- Document changes invalidate old output and prevent late responses from leaking into a different document's screen.
- Build and type checks pass; meaningful interaction checks cover review gating, source selection, stale-result invalidation, and the sample/real boundary.
- Frontend integration points are documented for the other developers; no server secrets or fake integration success is shipped.

The frontend can be reviewable before real endpoints are ready. Final end-to-end service verification depends on teammates' implementations and must be reported separately.

## Builder discretion

The builder may choose component decomposition, icon package, CSS organization, and exact spacing/breakpoints within this direction. Prefer minimal dependencies and readable components. The builder may choose the reliable supported Node runtime and font-loading method during setup. Do not change application scope or backend contracts without coordination.

## User-requested refinement — 2026-11-13

Jay requested conversational Filipino, less repeated text in the five-step process, equally sized review panels, a clickable explanation of the legal-advice limitation, removal of the landing eyebrow, and stronger button/form color distinction. The update adds an expandable explanation on the landing page and existing disclaimer surfaces, uses warm amber (#F4BD63) with navy text for primary actions, and introduces mint form surfaces. The original document text remains untouched. The added accent extends the original four-color palette at Jay's request.
