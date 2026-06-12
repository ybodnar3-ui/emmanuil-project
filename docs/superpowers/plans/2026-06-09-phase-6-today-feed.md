# Phase 6 — Today Feed + Cadence Engine + Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. The pure date/feed-assembly
> logic and the ownership-scoped data functions are **test-first** (mocked Prisma; no DB in
> unit tests). The AI talking-point call reuses Phase 4/5 plumbing and is mocked in tests.
> Follow existing conventions: scoped data layer + ownership, `requireUser()`, next-intl EN+UK,
> shadcn/ui. **AI code → invoke the `claude-api` skill, official `@anthropic-ai/sdk` only.**

**Goal:** Make the home tab a real **"Today" feed** — who to contact (cadence due), upcoming
birthdays, and due tasks — each item actionable (**Done** / **Snooze**) with an on-demand AI
"what to say" suggestion. Plus minimal **Tasks** (create one-off reminders with a due date).

**Architecture & a deliberate scope decision:**
- The feed is **computed live on read** from stored state (`Cadence.nextDueAt`,
  `Person.birthday`, `Task.dueAt`) — always correct, no stale cache. **No daily Cron is built
  this phase**: a cron is only needed to *push* notifications, which is post-MVP (MVP delivers
  in-app). The roadmap's "recompute" is the **pure feed-assembly function**, which IS unit-
  tested. This is a conscious YAGNI call, documented here so it isn't mistaken for a gap.
- **Pure core, tested:** date helpers (`daysUntilBirthday`, `isCadenceDue`, day-boundary math,
  all UTC to match the app's UTC date convention) and `assembleTodayFeed(...)` (merge + sort
  the three sources into one ordered list) are pure and unit-tested.
- **Data layer (ownership-scoped):** queries for the three sources + the action functions
  (`markContacted`, `snoozeCadence`, `createTask`, `completeTask`, `snoozeTask`,
  `reopenTask`?) — all scoped to the authenticated user; cadence/task mutations
  ownership-checked. Reuse `computeNextDueAt` (Phase 3) — do not duplicate.
- **AI talking point:** `suggestTalkingPoint(person, occasion, locale)` returns ONE short
  suggestion, on demand (per item, only when the user asks) — not auto-fired on render (keeps
  paid calls user-initiated). No-throw/no-leak contract.
- **Done semantics:** for a cadence item, Done sets `lastContactedAt = now` and
  `nextDueAt = computeNextDueAt(now, intervalDays)`. For a task, Done sets `status = "done"`.
  Snooze pushes `nextDueAt` / `dueAt` forward by a chosen number of days.

**Tech Stack:** Next.js 16 · Prisma 7 · `@anthropic-ai/sdk` (`claude-sonnet-4-6`) · zod 4 ·
shadcn/ui · next-intl · Vitest.

---

## File Structure

- `src/server/today/dates.ts` — pure date helpers (UTC): `startOfUtcDay`, `endOfUtcDay`, `daysUntilBirthday`, `isCadenceDue`.
- `src/server/today/feed.ts` — `FeedItem` type + pure `assembleTodayFeed(sources, now)` (merge/sort).
- `src/server/today/__tests__/dates.test.ts`, `feed.test.ts`.
- `src/server/data/today.ts` — `getTodayData(userId, now, birthdayWindowDays)` (the 3 queries) + `getTodayFeed(userId, now)` (queries → `assembleTodayFeed`).
- `src/server/data/cadenceActions.ts` — `markContacted(userId, personId, now)`, `snoozeCadence(userId, personId, days, now)` (ownership-checked).
- `src/server/data/tasks.ts` — `createTask(userId, input)`, `listOpenTasksDue(userId, now)`, `completeTask(userId, taskId)`, `snoozeTask(userId, taskId, days, now)` (ownership-checked).
- `src/server/data/__tests__/today.test.ts`, `tasks.test.ts`, `cadenceActions.test.ts`.
- `src/server/ai/suggest.ts` — `suggestTalkingPoint(person, occasion, locale)` (reuses AI client). `src/server/ai/__tests__/suggest.test.ts`.
- `src/server/validation/task.ts` — `taskInputSchema` (zod).
- `src/app/(app)/today/actions.ts` — server actions for all of the above.
- `src/app/(app)/page.tsx` — replace the Today placeholder with the live feed.
- `src/app/(app)/_components/today-feed.tsx`, `feed-item-card.tsx`, `add-task-form.tsx`, `talking-point.tsx` (client bits).
- i18n: `today.*` + `tasks.*` namespaces in `messages/en.json` + `messages/uk.json`.

---

## Task 1: Pure date helpers + feed assembly (test-first)

**Files:** `src/server/today/dates.ts`, `src/server/today/feed.ts`, + their tests

- [ ] **Step 1 (test-first): `dates.test.ts`** — drive these UTC helpers:
  - `startOfUtcDay(d)` / `endOfUtcDay(d)` → 00:00:00.000Z / 23:59:59.999Z of `d`'s UTC date.
  - `isCadenceDue(nextDueAt, now)` → true iff `nextDueAt <= endOfUtcDay(now)`.
  - `daysUntilBirthday(birthday, now)` → whole days until the next month/day occurrence
    (0 = today; ignores year; handles year-rollover; Feb 29 → treat as Mar 1 in common years).
  Then implement `src/server/today/dates.ts` to pass.

- [ ] **Step 2:** `src/server/today/feed.ts`:
```ts
export type FeedItem =
  | { type: "contact"; personId: string; personName: string; reason: "cadence"; dueAt: Date; overdueDays: number }
  | { type: "birthday"; personId: string; personName: string; birthday: Date; inDays: number }
  | { type: "task"; taskId: string; title: string; personId: string | null; personName: string | null; dueAt: Date; overdueDays: number };

export type FeedSources = {
  contacts: { personId: string; personName: string; nextDueAt: Date; intervalDays: number }[];
  birthdays: { personId: string; personName: string; birthday: Date }[];
  tasks: { taskId: string; title: string; personId: string | null; personName: string | null; dueAt: Date }[];
};

// Pure: build a single list sorted by urgency (most overdue / soonest first).
export function assembleTodayFeed(sources: FeedSources, now: Date): FeedItem[] { /* ... */ }
```
  Implement: map each source to a `FeedItem` (compute `overdueDays`/`inDays` via the date
  helpers), then sort (suggested: overdue tasks & contacts by most-overdue first, then today's
  birthdays, then upcoming). Keep the sort deterministic and documented.

- [ ] **Step 3 (test): `feed.test.ts`** — given mixed sources + a fixed `now`, assert the
  returned items have correct `overdueDays`/`inDays`, correct ordering, and that an empty
  source set yields `[]`.

- [ ] **Step 4:** `pnpm test` → PASS. Commit: `feat: pure Today date helpers + feed assembly`.

---

## Task 2: Tasks data layer + validation (ownership, test-first on scoping)

**Files:** `src/server/validation/task.ts`, `src/server/data/tasks.ts`, `src/server/data/__tests__/tasks.test.ts`

- [ ] **Step 1:** `src/server/validation/task.ts`:
```ts
import { z } from "zod";
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z.coerce.date(),
  personId: z.string().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;
```

- [ ] **Step 2:** `src/server/data/tasks.ts` — all userId-scoped:
  - `createTask(userId, input: TaskInput)`: if `input.personId` set, `assertPersonOwned(userId, personId)` first; create with `userId`.
  - `listOpenTasksDue(userId, now)`: `where:{ userId, status:"todo", dueAt:{ lte: endOfUtcDay(now) } }`, include person name.
  - `completeTask(userId, taskId)`: update `where:{ id: taskId, userId }` data `{status:"done"}` — scope in the where so another user's task can't be completed; if count 0, throw/no-op.
  - `snoozeTask(userId, taskId, days, now)`: load `where:{id,userId}`, set `dueAt = addUtcDays(base, days)` (base = max(now, current dueAt) or just now+days — pick and document).
  - `reopenTask` optional — SKIP for MVP.

- [ ] **Step 3 (test): `tasks.test.ts`** (mock `@/server/db`): `createTask` injects `userId` and
  calls `assertPersonOwned` when personId present (and NOT when absent); `completeTask`/`snoozeTask`
  scope by `{id, userId}` (assert the `where`); `listOpenTasksDue` filters status+dueAt+userId.

- [ ] **Step 4:** `pnpm test` → PASS. Commit: `feat: tasks data layer with ownership scoping`.

---

## Task 3: Cadence actions + Today data layer (ownership, tests)

**Files:** `src/server/data/cadenceActions.ts`, `src/server/data/today.ts`, `src/server/data/__tests__/cadenceActions.test.ts`, `today.test.ts`

- [ ] **Step 1:** `cadenceActions.ts`:
  - `markContacted(userId, personId, now)`: `assertPersonOwned` → upsert/update the person's
    `Cadence` so `lastContactedAt = now`, `nextDueAt = computeNextDueAt(now, intervalDays)`.
    If the person has no cadence, it's a no-op (nothing to advance) — document. Optionally also
    create a lightweight Interaction (`summary: "Reached out"`) — DECIDE: keep it minimal, just
    bump cadence (no forced interaction) for MVP; note the option.
  - `snoozeCadence(userId, personId, days, now)`: `assertPersonOwned` → set
    `nextDueAt = addUtcDays(now, days)` (does not change `lastContactedAt`).

- [ ] **Step 2:** `today.ts`:
  - `getTodayData(userId, now, birthdayWindowDays = 7)`: three scoped queries →
    `contacts` (cadences with `nextDueAt <= endOfUtcDay(now)` for this user's people, with name+interval),
    `birthdays` (this user's people with `birthday != null`, then filter in memory by
    `daysUntilBirthday <= birthdayWindowDays`),
    `tasks` (`listOpenTasksDue`).
  - `getTodayFeed(userId, now)`: call `getTodayData` then `assembleTodayFeed`.
  Use Prisma relations; scope every query by `userId` (cadence via `person: { userId }`).

- [ ] **Step 3 (test):** `cadenceActions.test.ts` — `markContacted` asserts ownership-before-write
  and `nextDueAt = computeNextDueAt(now, interval)`; `snoozeCadence` sets `nextDueAt = now + days`
  and ownership-checked. `today.test.ts` — mock prisma to return rows; assert all three queries
  are userId-scoped (cadence via `person:{userId}`) and that `getTodayFeed` returns the assembled
  list (you can spy on the assembly or assert the merged result).

- [ ] **Step 4:** `pnpm test` → PASS. Commit: `feat: cadence actions + Today feed data layer`.

---

## Task 4: AI talking point (mocked test) + server actions

**Files:** `src/server/ai/suggest.ts`, `src/server/ai/__tests__/suggest.test.ts`, `src/app/(app)/today/actions.ts`

- [ ] **Step 1:** `suggest.ts` — reuse `getAnthropic`, `BRIEF_MODEL`, `buildBriefContext`:
```ts
export type SuggestResult = { status: "ok"; suggestion: string } | { status: "error"; message: string };
// occasion: e.g. "time to reconnect (cadence due)" | "birthday in N days" | a task title
export async function suggestTalkingPoint(person: PersonForBrief, occasion: string, locale: string): Promise<SuggestResult> { /* messages.create, 1 short sentence, no-throw/no-leak */ }
```
  System prompt: one short, specific suggestion of what to say/ask, using ONLY the person's
  data, for the given occasion; locale-aware. `max_tokens` ~256.

- [ ] **Step 2 (test):** `suggest.test.ts` (mock client): success returns `{ok, suggestion}` and
  the person's data + occasion were in the request; throw → `{error:"REQUEST_FAILED"}` (no leak);
  empty → error.

- [ ] **Step 3:** `today/actions.ts` — `"use server"`, each `requireUser()` first:
  `markContactedAction(personId)`, `snoozeContactAction(personId, days)`,
  `createTaskAction(formData)` (zod via `taskInputSchema`; parse personId optional),
  `completeTaskAction(taskId)`, `snoozeTaskAction(taskId, days)`,
  `suggestTalkingPointAction(personId, occasion)` (getPerson ownership → suggestTalkingPoint).
  Each calls the scoped data fn with `user.id`, then `revalidatePath("/")` (and `/people/[id]`
  where relevant). Return typed `{status}` results; never throw to client.

- [ ] **Step 4:** `pnpm test` + `pnpm lint` + `pnpm build` green. Commit:
  `feat: talking-point AI + Today server actions`.

---

## Task 5: Today feed UI + Tasks

**Files:** `src/app/(app)/page.tsx`, `src/app/(app)/_components/{today-feed,feed-item-card,add-task-form,talking-point}.tsx`

- [ ] **Step 1:** `page.tsx` (server): `requireUser()`, `getTodayFeed(user.id, new Date())`,
  render the localized title, the `<AddTaskForm/>`, and `<TodayFeed items={...}/>`. Empty state
  uses `today.empty`.

- [ ] **Step 2:** `today-feed.tsx` (client/server split as needed): renders the feed items via
  `<FeedItemCard>`. Group or label by `type` (contact / birthday / task) using next-intl labels;
  show `overdueDays`/`inDays` ("3 days overdue", "birthday in 2 days").

- [ ] **Step 3:** `feed-item-card.tsx` (client): per item, an action row:
  - contact → **Done** (`markContactedAction`) + **Snooze** (`snoozeContactAction`, offer e.g. 3d/7d) + a link to the person.
  - task → **Done** (`completeTaskAction`) + **Snooze** (`snoozeTaskAction`).
  - birthday → a link to the person (+ optional "mark contacted" if they also have cadence).
  Use `useTransition`; disable while pending; on success rely on `revalidatePath` to refresh.
  Each card with a linked person shows a `<TalkingPoint personId occasion/>` control.

- [ ] **Step 4:** `talking-point.tsx` (client): a "What to say?" button → `suggestTalkingPointAction`,
  loading + error states, renders the one-line suggestion. On-demand only (no auto-fire).

- [ ] **Step 5:** `add-task-form.tsx` (client): title + date (+ optional person select from the
  user's people, + optional note); submits `createTaskAction` (`useActionState`); shows field
  errors; clears on success.

- [ ] **Step 6:** `pnpm build` + `pnpm lint` green. Manual gate (optional, needs session+data):
  set a cadence in the past / add a task due today / a person with a near birthday → all appear
  in Today; Done advances/closes them; Snooze reschedules; "What to say?" returns a suggestion.
  Commit: `feat: Today feed UI with Done/Snooze, tasks, and talking points`.

---

## Task 6: i18n + phase gate

- [ ] **Step 1:** Add `today.*` (`title`, `empty`, `section.contacts`, `section.birthdays`,
  `section.tasks`, `overdue`, `dueToday`, `birthdayInDays`, `birthdayToday`, `done`, `snooze`,
  `snooze3d`, `snooze7d`, `viewPerson`) and `tasks.*` (`add`, `titleLabel`, `dueLabel`,
  `personLabel`, `noteLabel`, `none`, `errors.*`) and `today.talkingPoint.*` (`button`,
  `loading`, `error`) to BOTH `messages/en.json` + `messages/uk.json`. Natural Ukrainian; keep
  EN/UK key parity. No hardcoded strings.

- [ ] **Step 2: Full gate:** `pnpm lint && pnpm test && pnpm build` all green.

- [ ] **Step 3: Push:** `git push origin main`.

---

## Phase 6 Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- [ ] The Today tab lists, for the signed-in user: people due for contact (cadence), upcoming
  birthdays, and due/overdue tasks — each scoped to that user.
- [ ] Marking a cadence contact **Done** sets `lastContactedAt = now` and advances `nextDueAt`
  (unit-tested via `computeNextDueAt`); **Snooze** reschedules it; completing a task closes it;
  snoozing a task reschedules it.
- [ ] The user can create a one-off task (title + due date, optional person/note) and it appears
  in Today when due.
- [ ] Each person-linked feed item offers an on-demand AI "what to say" suggestion (not
  auto-fired); AI failures degrade to a localized error, never a thrown 500 or leaked key.
- [ ] Date logic and feed assembly are pure + unit-tested (UTC, consistent with the app);
  data-layer mutations are ownership-scoped + unit-tested. (No daily Cron this phase — feed is
  computed live; cron is deferred to notification delivery, documented above.)
- [ ] All new copy EN+UK via next-intl keys; secrets never committed; pushed to `origin/main`.

## Carried-forward notes
- Daily Cron + notification delivery (in-app push / Telegram / web-push) is post-MVP.
- "Mark contacted" logging a full Interaction record (vs. only bumping cadence) can be added if
  history fidelity is wanted.
- Phase 7: i18n completeness sweep + PWA-readiness (manifest, mobile polish).
