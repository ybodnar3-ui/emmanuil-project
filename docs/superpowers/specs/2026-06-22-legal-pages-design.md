# Legal Pages — Privacy Policy + Terms (Item #4) — Design Spec

**Date:** 2026-06-22 · **Status:** Approved (design). Adds public Privacy Policy + Terms of Service
pages so the app — which stores personal data about the user's contacts — has the basic legal
surface expected of a real product.

> **Not legal advice.** These are honest starting-draft templates describing the app's ACTUAL data
> practices. Each page carries a visible notice that it is a template to be reviewed by a
> professional before any commercial launch. The author is not a lawyer.

## Decisions (from brainstorming)
- **Operator:** the developer as an individual; contact `ybodnar3@gmail.com`; governing law:
  Ukraine. (Easy to swap for a company/ФОП later — it lives in one content constant.)
- **Self-hosted static pages** (no third-party policy vendor, no embed/script).
- **Content lives in a per-locale content module**, NOT in `messages/*.json` (long prose would
  bloat the parity-checked catalog). Only nav/labels go in next-intl.
- Bilingual EN+UK, Quiet-Luxury styling.
- No cookie-consent banner (only essential cookies: auth + locale). No explicit 18+ gate, no
  separate GDPR-rights section beyond the access/delete coverage already included (kept lean).

## Architecture & components

**Routes (public — OUTSIDE the `(app)` auth group):**
- `src/app/legal/layout.tsx` — shared layout: Quiet-Luxury container, page title, the "draft /
  not legal advice" notice banner, an effective-date line, and a "← back" link (to `/login`).
- `src/app/legal/privacy/page.tsx` — renders the Privacy sections for the active locale.
- `src/app/legal/terms/page.tsx` — renders the Terms sections for the active locale.
Server components; locale via the existing cookie helper (`getLocaleFromCookie`). These render
without auth (a prospective user / app-store reviewer can read them logged-out).

**Content (`src/app/legal/content.ts`, new):**
A typed module exporting the legal copy keyed by locale and document:
```ts
type Section = { heading: string; body: string[] };       // body = paragraphs
type LegalDoc = { title: string; sections: Section[] };
export const OPERATOR = { name: "…", contact: "ybodnar3@gmail.com", jurisdiction: "Ukraine" };
export const EFFECTIVE_DATE = "2026-06-22";
export const PRIVACY: Record<"en" | "uk", LegalDoc>;
export const TERMS: Record<"en" | "uk", LegalDoc>;
```
The page picks `PRIVACY[locale]` / `TERMS[locale]` (fallback to `en`). A tiny renderer maps
sections → headings + paragraphs (reuse plain elements; no Markdown needed).

**Privacy Policy content (describes real practices):**
- What is collected: account email (via Supabase Auth); the data the user enters about their
  contacts (names, facts, interactions, key dates, photos); voice audio is processed transiently
  and not stored.
- Processors / sub-processors: Anthropic (Claude) for AI features; Groq (Whisper) for voice
  transcription; Supabase for database/storage/auth; Vercel for hosting. Data is sent to these to
  provide the service; not sold or used for advertising.
- Cookies: essential only (authentication + language). No analytics/tracking cookies.
- Retention & deletion: data is kept while the account exists; the user can delete their data /
  request deletion via the contact email.
- User responsibility: the user is the controller of the personal data they store about third
  parties and must have a lawful basis for storing it.
- Contact + governing law (Ukraine). (When Item #5 adds Sentry, append it to the processors list.)

**Terms of Service content:**
- The service is provided "as is", without warranties.
- AI output may be inaccurate — do not rely on it as professional advice.
- The user is responsible for lawful use and for the data they input.
- Acceptable use; account suspension/termination for abuse.
- Limitation of liability; changes to the terms (with the effective date); governing law Ukraine.

**Placement / links:**
- Login: a small footer line under the form — "Privacy · Terms" (links to the two pages).
- Settings: a "Legal" card with links to both pages (consistent with the other Settings cards).

**i18n (`messages/en.json` + `messages/uk.json`):** only labels —
`legal.privacy` ("Privacy Policy"), `legal.terms` ("Terms of Service"), `legal.title` ("Legal"),
`legal.back` ("← Back"), `legal.draftNotice` (the not-legal-advice banner text),
`legal.effective` ("Effective {date}"). Parity enforced.

## Data flow
Static content only — no DB, no user data, no mutations. The page reads the locale cookie and
renders the matching content constant.

## Error handling
Presentational, no new failure modes. Pages render logged-out; an unknown locale falls back to EN.

## Testing
- Both legal pages render their title + the draft notice (smoke, jsdom).
- Content parity: `PRIVACY.en` and `PRIVACY.uk` have the same number of sections (and same for
  `TERMS`) — a small unit test over the content module.
- EN/UK parity for the new `legal.*` label keys (existing parity test).
- Links present on the login form and in Settings.

## Out of scope
- Cookie-consent banner (essential-only cookies); analytics integration.
- A self-service "delete my account" button (deletion is via contact email for now; a future item).
- Lawyer-grade / jurisdiction-specific compliance text — this is a starting draft.

## Acceptance
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity (labels + content sections).
- `/legal/privacy` and `/legal/terms` render logged-out in both locales, each with the draft
  notice, effective date, and accurate descriptions of the app's data practices.
- Links reachable from `/login` and Settings; Quiet-Luxury styling; no DB change; pushed to `main`.
