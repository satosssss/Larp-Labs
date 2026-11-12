# LegaLinaw

**Palinawin natin ang legal notice mo.**

A Filipino/English web interface for reviewing legal notices, understanding their wording, and preparing for human legal help. Built by Larp Labs for OVERCLOCK 2026.

## Current status

This branch implements Jay's frontend: the landing page, five-step guided flow, source highlighting, document chat presentation, consultation checklist/questions, official help links, and sender-checking guide. The sample journey uses explicitly fictional, prewritten data. **It does not call Lumen or analyze real documents yet.** Real files stay local and produce a clear unavailable message until the team's backend adapter is connected.

## Run locally

Use Node **20.19.6 or newer** (the project's `.nvmrc` selects 20.19.6).

```sh
nvm use
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Choose **Subukan ang halimbawa** to explore the complete sample journey. No environment variables or credentials are required for the frontend preview.

## Routes

| Route              | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `/`                | Landing page                                        |
| `/notice`          | Upload and guided document flow                     |
| `/notice?sample=1` | Fictional sample journey                            |
| `/help`            | Directory interface and official national resources |
| `/verify`          | General sender-checking guide                       |

`SharedSummary` is a presentation component for the backend owner's future `/s/[id]` route; this branch does not host a public sharing service.

## Verify

```sh
npm test
npm run typecheck
npm run build
# Start npm run dev or npm run start in another terminal first:
npm run test:e2e
```

Browser tests use local Google Chrome (`channel: chrome`) at desktop and 360 px sizes. If Chrome is missing, install it or adapt `playwright.config.ts` to a Playwright-managed Chromium. Checks cover the sample journey, source highlighting, document reset, real/sample boundaries, editable preparation, language switching, text enlargement, and automated accessibility scans. Automated checks do not replace manual screen-reader review.

## Integration and ownership

See [frontend handoff](docs/frontend-handoff.md) for contracts and remaining integration work. Jay owns the UI; Oropilla owns Lumen/AI; San Gaspar owns APIs, storage, sessions, PDF generation and deployment; Acierto owns reviewed legal content and directory data.

Next.js App Router · React · TypeScript · Zustand · Geist · Lucide · CSS.

The existing `.kiro/specs/legalinaw/` files remain intact. The approved visual design and implementation plan are in `docs/superpowers/`.
