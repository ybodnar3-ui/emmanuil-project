# Proactive Personalized Reminders — Design Spec (Phase A)

**Date:** 2026-06-13 · **Status:** Approved (design). Fixes the core divergence from the
client's vision: the product drifted toward a generic task manager, and reminders are bare
("contact X") instead of proactive + personalized ("reach out to X — ask about their son in
London"). This phase makes reminders **person-centric and personalized**, and removes the
generic-task feel.

## Why (client's intent, re-read)
> "the bot itself gives you reminders to reach out and ask 'how's their kid?' … it automatically
> generates, at intervals, what to contact them about and what to ask … personalized questions
> from what you stored."

So a reminder must (1) always be about a **person**, and (2) carry a **personalized "what to
ask"** generated from that person's stored facts. The home page must read as "the people you
should reconnect with," not a to-do list. Generic, person-less tasks were a YAGNI addition that
caused the task-manager feel — they are removed.

## Decisions (from brainstorming)
- **AI-generated, humanized** "what to ask", from the person's facts + recent interactions.
- **Repetition is fine** — no elaborate topic-rotation machinery (the client explicitly said too
  much variety is odd). One personalized prompt per cadence cycle; if the person has no facts,
  fall back to a warm generic line.
- **Generated when due, cached per cadence cycle** (one AI call per due person per cycle — cheap;
  usually a cache hit on render).
- **No generic tasks.** One-off reminders are **person-anchored** ("remind me to follow up with
  this person on <date> about <note>"), created from the Person card.
- **Telegram** daily reminder reuses the same personalized text (it's de-prioritized vs future
  native push — Phase C — but it's a trivial reuse, so keep it consistent rather than bare names).
- Native iPhone push (PWA web push) is **Phase C** (separate). Family/key-date birthdays are
  **Phase B**. This spec is **Phase A only**.

## Scope (Phase A)
IN: personalized reminder generation + caching; person-centric home ("People to reconnect with");
remove generic tasks / home add-task form; person-anchored one-off reminders from the Person
card; Telegram reminder carries the personalized text. Person's own birthday section stays as-is.
OUT (later): family/key-date birthdays (B), native push (C), topic-rotation, usage metering.

## Architecture & components

**Schema (`prisma/schema.prisma`) — additive, nullable migration:**
- `Cadence`: add `reminderPrompt String?` + `reminderPromptAt DateTime?` (cache the generated
  prompt for the current cycle).

**AI generation (reuse existing):**
- Reuse `suggestTalkingPoint(person, occasion, locale)` (`src/server/ai/suggest.ts`) to produce
  the personalized reminder text; pass an occasion like "It's time to reconnect (every N days)".
  It already honors the no-throw/no-leak contract. On error or empty → a **deterministic warm
  fallback** (localized, e.g. "Check in and see how things are going") so a reminder ALWAYS has
  text. No new AI module.

**Reminder caching (`src/server/data/reminders.ts`, new):**
- `getOrCreateReminderPrompt(userId, personId, now)`: `assertPersonOwned`; if `reminderPromptAt`
  is null OR earlier than `Cadence.lastContactedAt` (a new cycle began) → fetch the person
  (facts + recent interactions), call `suggestTalkingPoint`, persist `reminderPrompt` +
  `reminderPromptAt = now`, return it; else return the cached `reminderPrompt`. Ownership-scoped,
  no-throw (fallback text on failure).

**Today feed (`src/server/data/today.ts` + `src/server/today/feed.ts`):**
- For each cadence-due **contact**, attach `prompt: string` (from `getOrCreateReminderPrompt`).
  The `FeedItem` `contact` variant gains a `prompt` field. Birthdays unchanged (own birthday).
- **Reminders (formerly generic tasks):** still surfaced when due, but ALWAYS carry a person
  (see below). Keep them in the feed labeled as person follow-ups.
- Note: generating prompts during the home Server-Component render adds latency only when a new
  cycle just became due (few people); cache hits are instant. Acceptable at MVP scale; can move
  to a background job later.

**Person-anchored reminders (rework, not rename):**
- Keep the `Task` model (it has `personId?`, `dueAt`, `note`, `status`), but the **creation path
  requires a person**. Add a "Set a reminder" control on the **Person card** (note + date) →
  `createTask(userId, { personId: <this person>, title/note, dueAt })`. Remove the generic
  **add-task form from the home page**. `completeTask`/`snoozeTask` reused.
- The home "Tasks" section becomes "Follow-ups" and only ever shows person-tied reminders.

**Home page (`src/app/(app)/page.tsx` + `_components/`):**
- Reframe to **"People to reconnect with"**: each due contact card shows the person + the baked-in
  personalized `prompt` + Done/Snooze + link. A "Birthdays" section (own birthdays). A
  "Follow-ups" section (person-anchored reminders). **No add-task form, no generic tasks.**
- Remove `add-task-form.tsx` from the home; the on-demand "What to say?" button is replaced by
  the always-present baked-in prompt (the `TalkingPoint` on-demand component is no longer needed
  on contact cards — remove or repurpose).

**Telegram (`src/server/telegram/format.ts` + cron):**
- The contacts section lists each person **with their personalized prompt** (reuse the cached
  `reminderPrompt`), not bare names. Follow-ups carry their person. Birthdays unchanged.

## Data flow
Cadence due → `getOrCreateReminderPrompt` (cache hit, or AI gen from facts+interactions, cached on
Cadence) → baked into the Today feed card AND the Telegram message → user reads "reach out to X —
ask about <their thing>" → Done (advance cadence, clears the cached prompt for next cycle via the
`lastContactedAt` comparison) / Snooze.

## Error handling
- AI failure / no facts → deterministic localized fallback text (reminder still appears). No-leak.
- All data access ownership-scoped; no-throw to the client; `logError` server-side.
- Removing the home add-task must not break existing person-anchored reminder creation.

## Testing
- `getOrCreateReminderPrompt`: cache-hit vs regenerate-on-new-cycle (mock prisma + suggestTalkingPoint);
  ownership-checked; fallback text on AI error.
- Today feed: due contact carries `prompt`; reminders are person-tied.
- Person-card reminder creation requires a person (createTask called with personId).
- Telegram formatter includes the personalized prompt per contact.
- EN/UK parity for new copy; existing tests stay green (update any that asserted the removed
  add-task / generic-task home behavior).

## Acceptance (Phase A)
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity.
- The home page reads as "people to reconnect with"; each due person shows a personalized,
  AI-generated "what to ask" baked in (cached per cycle, from their facts); no generic add-task
  form / generic tasks anywhere.
- One-off reminders can only be created tied to a person (from the Person card).
- The Telegram daily reminder carries the personalized prompts, not bare names.
- AI failures degrade to a warm fallback; no key/secret leaks; reminders always have text.
