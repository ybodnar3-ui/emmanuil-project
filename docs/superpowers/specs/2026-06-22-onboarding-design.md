# Lightweight Onboarding / Empty States (Item #3) — Design Spec

**Date:** 2026-06-22 · **Status:** Approved (design). Makes a brand-new user who lands on an
empty app understand what to do and reach value fast — without a multi-step wizard.

## Decision (from brainstorming)
- **State-derived onboarding, no persistence.** The empty states ARE the onboarding. Helpful,
  action-oriented copy + CTAs show while the app is empty and disappear automatically once the
  user has data. No new DB field, no "dismissed" flag, no onboarding-progress tracking — that is
  the "one-time" behaviour, derived from state (YAGNI).
- **Light, not a wizard.** No multi-step flow, no product tour / tooltips.
- Bilingual EN+UK, Quiet-Luxury design, reusing the existing empty-state card.

## Architecture & components

**Shared `EmptyState` component (`src/app/(app)/_components/empty-state.tsx`, new):**
A presentational component matching the current empty-state card (rounded-2xl border, centered,
`font-heading` title). Props:
```ts
{
  title: string;            // Playfair heading line
  description?: string;     // muted explanatory line
  action?: { href: string; label: string };      // primary CTA (Button as Link)
  secondary?: { href: string; label: string };    // secondary link line
}
```
It renders the title, optional description, optional primary CTA button, and optional secondary
link. Used by every empty surface so the look is consistent and the logic lives in one place.

**1. People list — `src/app/(app)/people/page.tsx`** (0 people = the main onboarding moment):
- title: `people.emptyTitle` ("Add your first person")
- description: `people.emptyHint` ("Save a contact and a few facts — Emmanuil reminds you when to
  reach out and what to ask.")
- action: → `/people/new`, label `people.add` (reuse existing "Add")
- secondary: → `/assistant`, label `people.emptyAssistant` ("…or just tell the assistant — type or
  speak")
Replaces the bare `people.empty` line.

**2. Today feed — `src/app/(app)/page.tsx`** (branch on whether the user has any people):
- Compute `hasPeople` cheaply (a `countPeople(userId)` data-layer helper, `prisma.person.count`).
- 0 people (new user) → same "Add your first person" `EmptyState` with the `/people/new` CTA
  (title `today.emptyNewTitle`, description `today.emptyNewHint`, action label `people.add`).
- Has people, nothing due today → keep the current calm message (`today.empty`, "No one to reach
  out to today. Enjoy the calm.") via `EmptyState` with title only.

**3. Assistant — `src/app/(app)/assistant/_components/assistant-chat.tsx`** (first-run hint before
any message): when the message list is empty, render 2–3 example prompts + a voice hint inside the
chat area (not a blocking screen). New keys under `assistant.examples.*`:
- capture example: "Try: \"Maria's son Andrii just started at LSE\""
- query example: "Ask: \"What do I know about Maria?\""
- voice hint: "Type, or tap the mic to dictate."
Read the component first; render the hint only when there are no messages yet (it disappears once
the conversation starts). Keep it presentational — no logic change to send/capture.

**4. Person card — facts & interactions empty sections** (`src/app/(app)/people/[id]/...`): warmer
copy on the existing empty lines:
- facts `person.facts.empty`: "Add what you know — family, work, what to ask about."
- interactions `person.interactions.empty`: "Log a call or meeting to start the timeline."
Copy-only; no structural change. (If these sections already render bare strings inline, swap the
string; an `EmptyState` here is optional and not required.)

## Data flow
Server components already resolve the user + their data. Add only `countPeople(userId)` for the
Today branch (People page already has the list length; the card sections already know if facts/
interactions are empty). No client state, no new persistence.

## Error handling
Presentational layer — no new failure modes. `countPeople` is a plain scoped count
(`where: { userId }`); if the page data load fails, the existing route error boundary handles it.

## Testing
- `EmptyState` renders title always; CTA button + secondary link only when provided (with correct
  `href`/label).
- Today page shows the new-user onboarding variant when `hasPeople` is false and the calm variant
  when true (test the branch via the data helper / a small extracted decision, mocking the count).
- `countPeople` is userId-scoped (mock prisma, assert `where: { userId }`).
- EN/UK parity for all new keys; existing tests stay green.

## Out of scope
- Multi-step wizard, product tour / coachmarks / tooltips.
- Persisted onboarding flag or progress tracking.
- Sample/demo data seeding.

## Acceptance
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity.
- A new user with zero people sees a clear "Add your first person" CTA on both the Today tab and
  the People tab, plus an assistant hint with example prompts and a voice mention; the prompts
  disappear once they have data.
- Quiet-Luxury styling preserved; no new DB schema; pushed to `main`.
