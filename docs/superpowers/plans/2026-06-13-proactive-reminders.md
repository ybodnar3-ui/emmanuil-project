# Proactive Personalized Reminders (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Data layer + caching are
> **test-first** (mock `@/server/db` and `@/server/ai/suggest`; no real network/DB). UI uses
> build/render gates. Conventions: per-user scoping + ownership, `requireUser()`, next-intl EN+UK
> (parity test must stay green), no-throw/no-leak on AI, `logError` server-side.

**Goal:** Make the home page "people to reconnect with" where each due person shows an
AI-generated, personalized "what to ask" baked in (cached per cadence cycle, from their stored
facts); remove generic tasks in favor of person-anchored reminders; carry the personalized text
into the Telegram reminder.

**Architecture:** Cache a generated reminder prompt on `Cadence` (regenerated each cycle). Reuse
the existing `suggestTalkingPoint` AI fn (no new AI module), with a deterministic warm fallback.
The Today feed attaches the prompt to each due contact; the home page and Telegram message bake
it in. Generic tasks become person-required reminders created from the Person card.

**Tech Stack:** Next.js 16 · Prisma 7 · existing `suggestTalkingPoint` (Anthropic) · next-intl ·
Vitest.

---

## File structure
- `prisma/schema.prisma` — `Cadence.reminderPrompt`/`reminderPromptAt` (+ migration).
- `src/server/data/reminders.ts` (new) — `getOrCreateReminderPrompt` + `fallbackPrompt`.
- `src/server/data/reminders.test.ts` (or `__tests__/`) — caching/ownership/fallback tests.
- `src/server/today/feed.ts` — `FeedItem` contact variant gains `prompt`.
- `src/server/data/today.ts` — attach prompt per due contact.
- `src/server/data/tasks.ts` — `createTask` requires `personId` (reminders are person-tied).
- `src/app/(app)/people/[id]/_components/reminder-form.tsx` (new) — "Set a reminder" on the card.
- `src/app/(app)/people/[id]/page.tsx` — render the reminder form.
- `src/app/(app)/people/actions.ts` — `createReminderAction` (person-anchored).
- `src/app/(app)/page.tsx` + `src/app/(app)/_components/{today-feed,feed-item-card}.tsx` — home reframe; REMOVE `add-task-form.tsx` usage + generic tasks; bake prompt into contact cards (remove on-demand `talking-point.tsx`).
- `src/app/(app)/today/actions.ts` — drop the generic `createTaskAction` from the home path.
- `src/server/telegram/format.ts` — contacts carry the personalized prompt.
- `messages/en.json` + `messages/uk.json` — copy updates.

---

## Task 1: Schema — cache fields on Cadence

**Files:** `prisma/schema.prisma`, migration

- [ ] **Step 1:** Add to `model Cadence`: `reminderPrompt String?` and `reminderPromptAt DateTime?`.
- [ ] **Step 2:** `pnpm db:format` (exit 0).
- [ ] **Step 3:** Create + apply migration (DIRECT_URL): `pnpm exec prisma migrate dev --name cadence_reminder_prompt`. Expected: applied, "in sync". `pnpm db:generate`.
- [ ] **Step 4: Commit:** `feat: cache reminder prompt on Cadence`.

---

## Task 2: Reminder prompt generation + caching (test-first)

**Files:** `src/server/data/reminders.ts`, `src/server/data/__tests__/reminders.test.ts`

- [ ] **Step 1 (test-first):** `reminders.test.ts` — mock `@/server/db` and `@/server/ai/suggest`:
  - **cache hit:** cadence has `reminderPrompt:"X"`, `reminderPromptAt` AFTER `lastContactedAt` →
    returns "X" WITHOUT calling `suggestTalkingPoint` or writing.
  - **new cycle (stale):** `reminderPromptAt` is null (or before `lastContactedAt`) →
    `assertPersonOwned` is called, `suggestTalkingPoint` is called, the result is persisted
    (`cadence.update` with `reminderPrompt` + `reminderPromptAt`), and that text is returned.
  - **AI failure:** `suggestTalkingPoint` returns `{status:"error"}` → returns the deterministic
    `fallbackPrompt(locale)` text (non-empty), still persisted.
  - **not owned:** `assertPersonOwned` throws → propagates (caller handles) OR returns fallback —
    pick: it should require ownership; assert it does NOT generate for an unowned person.

- [ ] **Step 2:** Implement `src/server/data/reminders.ts`:
```ts
import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { suggestTalkingPoint } from "@/server/ai/suggest";

export function fallbackPrompt(locale: string): string {
  return locale === "uk"
    ? "Час написати — дізнайтесь, як справи, і підтримайте зв'язок."
    : "Time to reach out — check in and see how they're doing.";
}

// Returns a personalized "what to ask" for a due person, generated once per cadence cycle
// and cached on the Cadence row. Ownership-checked; never throws to the caller.
export async function getOrCreateReminderPrompt(
  userId: string,
  personId: string,
  locale: string,
  now: Date,
): Promise<string> {
  await assertPersonOwned(userId, personId);
  const cadence = await prisma.cadence.findUnique({ where: { personId } });
  if (!cadence) return fallbackPrompt(locale);
  const fresh =
    cadence.reminderPromptAt != null &&
    (cadence.lastContactedAt == null || cadence.reminderPromptAt >= cadence.lastContactedAt);
  if (fresh && cadence.reminderPrompt) return cadence.reminderPrompt;

  const person = await prisma.person.findFirst({
    where: { id: personId, userId },
    include: {
      facts: { orderBy: { createdAt: "desc" } },
      interactions: { orderBy: { date: "desc" }, take: 5 },
    },
  });
  let text = fallbackPrompt(locale);
  if (person) {
    const occasion = locale === "uk" ? "Час відновити контакт за каденцією" : "Time to reconnect (cadence due)";
    const r = await suggestTalkingPoint(person, occasion, locale);
    if (r.status === "ok" && r.suggestion.trim()) text = r.suggestion.trim();
  }
  await prisma.cadence.update({
    where: { personId },
    data: { reminderPrompt: text, reminderPromptAt: now },
  });
  return text;
}
```
  (Verify `suggestTalkingPoint`'s real signature/return shape in `src/server/ai/suggest.ts` and
  its `PersonForBrief`-style input; adapt the `include`/mapping to match what it expects.)

- [ ] **Step 3:** `pnpm test src/server/data/__tests__/reminders.test.ts` → PASS.
- [ ] **Step 4: Commit:** `feat: per-cycle cached personalized reminder prompt`.

---

## Task 3: Attach the prompt to the Today feed (test-first on the type/flow)

**Files:** `src/server/today/feed.ts`, `src/server/data/today.ts`, extend `today.test.ts`

- [ ] **Step 1:** In `feed.ts`, add `prompt: string` to the `contact` `FeedItem` variant and to
  the corresponding `FeedSources.contacts` entry (carry it through `assembleTodayFeed` unchanged
  otherwise).
- [ ] **Step 2:** In `today.ts` `getTodayData`/`getTodayFeed`: for each cadence-due contact, call
  `getOrCreateReminderPrompt(userId, personId, locale, now)` (await in parallel via
  `Promise.all`) and include `prompt` on the contact source. `getTodayFeed` must now take/derive
  `locale` (read via `getLocaleFromCookie` in the caller, or pass it in — keep it a param for
  testability: `getTodayFeed(userId, now, locale)`).
- [ ] **Step 3 (test):** extend `today.test.ts` — mock `getOrCreateReminderPrompt`; assert each
  due contact in the feed has the `prompt`. Keep existing today tests green (update the
  `getTodayFeed` signature call sites in tests).
- [ ] **Step 4:** `pnpm test` (today) → PASS. Commit: `feat: bake personalized prompt into Today feed contacts`.

---

## Task 4: Person-anchored reminders (require a person; create from the Person card)

**Files:** `src/server/data/tasks.ts`, `src/app/(app)/people/actions.ts`, `src/app/(app)/people/[id]/_components/reminder-form.tsx`, `src/app/(app)/people/[id]/page.tsx`; extend tasks test

- [ ] **Step 1:** `tasks.ts` `createTask`: make `personId` **required** (type + runtime). Update
  the input type so `personId: string` (not optional); keep `assertPersonOwned(userId, personId)`
  first. (Existing `listOpenTasksDue`/`completeTask`/`snoozeTask` unchanged.)
- [ ] **Step 2:** `people/actions.ts`: add `createReminderAction(formData)` — `requireUser()` →
  zod-validate (reuse/extend `taskInputSchema` but with required `personId`) → `createTask(user.id,
  {personId, title, dueAt, note})` wrapped in try/catch (return typed error; log) →
  `revalidatePath("/")`. Mirror the existing guarded-action pattern.
- [ ] **Step 3:** `reminder-form.tsx` (client) on the Person card: a small form (what to remember
  + date) → `createReminderAction` with the person's id bound; `useActionState`; localized labels
  (`people.reminder.*`); success clears.
- [ ] **Step 4:** Render `<ReminderForm personId={person.id} />` on `[id]/page.tsx` (e.g. near the
  cadence/"Stay in touch" section).
- [ ] **Step 5 (test):** extend `tasks` test — `createTask` requires personId (a call without it
  is a type error / rejected); `createReminderAction` happy path calls `createTask` with the
  person id (mock data layer + requireUser).
- [ ] **Step 6:** `pnpm test` + `pnpm lint` + `pnpm build` green. Commit:
  `feat: person-anchored reminders created from the person card`.

---

## Task 5: Home reframe — "People to reconnect with" (remove generic tasks)

**Files:** `src/app/(app)/page.tsx`, `src/app/(app)/_components/today-feed.tsx`, `feed-item-card.tsx`; remove `add-task-form.tsx` + `talking-point.tsx` usage; `src/app/(app)/today/actions.ts`

- [ ] **Step 1:** `page.tsx`: call `getTodayFeed(user.id, new Date(), locale)` (locale via
  `getLocaleFromCookie`). Remove the `<AddTaskForm/>` render entirely. Update the page heading/copy
  to the "people to reconnect with" framing (`today.title`/`today.subtitle` keys).
- [ ] **Step 2:** `feed-item-card.tsx`: for a `contact` item, render the person + the baked-in
  `item.prompt` (always visible) + Done/Snooze + link. REMOVE the on-demand `<TalkingPoint>` (the
  prompt is now baked in). For a `task`(reminder) item, show it under its person (it always has
  one now) in a "Follow-ups" grouping. Birthdays unchanged.
- [ ] **Step 3:** `today-feed.tsx`: section labels become "People to reconnect with" /
  "Birthdays" / "Follow-ups" (next-intl keys). No "add task" entry point. Empty state copy:
  calm "no one to reach out to today".
- [ ] **Step 4:** Delete `add-task-form.tsx`; delete `talking-point.tsx` if no longer imported
  (grep). In `today/actions.ts`, remove `createTaskAction` if it was only used by the home
  add-task form (keep `completeTaskAction`/`snoozeTaskAction` — still used by feed items). Verify
  nothing else imports the removed pieces.
- [ ] **Step 5:** `pnpm lint` + `pnpm build` green. Manual gate (optional, with a seeded due
  person): the home shows the person + a personalized "what to ask" baked in, Done/Snooze work, no
  add-task form anywhere. Commit: `feat: person-centric home (remove generic tasks)`.

---

## Task 6: Telegram reminder carries the personalized prompt

**Files:** `src/server/telegram/format.ts`, the cron caller (`src/app/api/cron/reminders/route.ts`), extend format test

- [ ] **Step 1:** `format.ts`: the `contact` `FeedItem` now has `prompt` — render each contact as
  the name + its prompt (escaped), e.g. `• <b>{name}</b>\n  {prompt}`. Keep HTML-escaping on ALL
  interpolated text (name + prompt). Birthdays/follow-ups unchanged (follow-ups show their person).
- [ ] **Step 2:** Cron caller already builds the feed per user — ensure it passes the user's
  locale so contacts get prompts (the feed now carries them). No bare-name path remains.
- [ ] **Step 3 (test):** extend `format.test.ts` — a contact with a `prompt` renders the prompt
  text and escapes it; empty feed still returns null.
- [ ] **Step 4:** `pnpm test` + `pnpm build` green. Commit: `feat: Telegram reminder carries personalized prompts`.

---

## Task 7: i18n + phase gate

- [ ] **Step 1:** Update/add next-intl keys in BOTH `messages/en.json` + `messages/uk.json`
  (natural Ukrainian, keep parity): home `today.title`/`today.subtitle`,
  section labels (`reconnect`, `birthdays`, `followUps`), empty states, `people.reminder.*`
  (label, dateLabel, add, errors). Remove now-unused keys (old add-task/`talkingPoint` keys) ONLY
  if truly unreferenced (grep). Keep EN/UK parity test green.
- [ ] **Step 2: Full gate:** `pnpm lint && pnpm test && pnpm build` all green; parity green.
- [ ] **Step 3: Push:** `git push origin main` (auto-deploys).

---

## Done criteria (Phase A)
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity holds.
- Home reads as "people to reconnect with"; each due person shows an AI-generated personalized
  "what to ask" baked in (cached per cadence cycle on `Cadence`, from their facts; warm fallback
  on AI failure). No generic add-task form / generic tasks anywhere.
- One-off reminders are created only tied to a person (from the Person card); `createTask`
  requires `personId`.
- The Telegram daily reminder lists each contact with their personalized prompt, not bare names.
- AI failures degrade to a warm fallback; ownership-scoped; no key/secret leaks; reminders always
  have text. Committed + pushed.

## Self-review
- Spec coverage: cache fields (T1), generation+cache+fallback+ownership (T2), feed baked-in (T3),
  person-anchored reminders + remove home add-task (T4, T5), home reframe + remove generic tasks
  (T5), Telegram personalized (T6), i18n (T7). ✓
- Types: `getOrCreateReminderPrompt(userId, personId, locale, now): Promise<string>` (T2) used in
  T3; `FeedItem.contact.prompt: string` (T3) used in T5/T6; `createTask` requires `personId` (T4)
  used in T5. ✓
- No placeholders; real code in code steps. The implementer must verify `suggestTalkingPoint`'s
  exact signature and the `getTodayFeed` call sites before wiring. ✓
