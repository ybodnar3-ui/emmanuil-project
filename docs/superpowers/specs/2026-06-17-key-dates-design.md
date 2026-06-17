# Key Dates (Phase B) — Design Spec

**Date:** 2026-06-17 · **Status:** Approved (design). Builds on the proactive-reminders work
(Phase A). Adds per-person **key dates** (family birthdays, anniversaries, any labeled date) so
the app reminds you to greet people on the day — e.g. "Wish Maria a happy birthday for her son
Andrii." Part of the client's vision ("if it's recorded that their son's birthday is on a date,
remind me to wish them"). Bilingual EN+UK; reuse the existing birthday/feed machinery.

## Decisions (from brainstorming)
- **General labeled dates**, not just birthdays: a free-text `label` + a `date`. Covers
  birthdays, anniversaries, etc. (Birthdays are the common case; no separate type enum.)
- **Annual recurrence** by month/day (same as the person's own birthday). The stored year is for
  age/context only and is otherwise ignored when computing "upcoming".
- **Capture two ways:** (1) manually on the Person card ("Key dates" section), (2) via the
  assistant — extend the interpret/proposal flow to extract dates from natural language ("his
  son's birthday is March 3") and propose adding them (user confirms, same as facts).
- **Greeting text is deterministic** (template from the label) — no AI needed for greetings.
- Person's OWN birthday (existing `Person.birthday` + Today birthday section) stays; key dates
  are additive and shown in the same "Birthdays & dates" area.

## Architecture & components

**Schema (`prisma/schema.prisma`) — additive migration:**
- New model `KeyDate`: `id` (cuid), `personId` (FK → Person, `onDelete: Cascade`), `label`
  (String), `date` (DateTime), `createdAt`. Index on `personId`. Relation added to `Person`.

**Validation (`src/server/validation/person.ts` or a new `keydate.ts`):**
- `keyDateInputSchema`: `{ label: string().trim().min(1).max(200), date: z.coerce.date() }`.

**Data layer (`src/server/data/keydates.ts`, new) — all ownership-scoped:**
- `addKeyDate(userId, personId, input)` — `assertPersonOwned` then create.
- `deleteKeyDate(userId, keyDateId)` — load with `include: { person: { select: { userId } } }`,
  verify `keyDate.person.userId === userId`, then delete (cross-table ownership check, like
  `deleteFact`).
- `listKeyDates(userId, personId)` — `assertPersonOwned` then list.
- `getUpcomingKeyDates(userId, now, windowDays = 7)` — fetch this user's key dates (via
  `person: { userId }`), filter in memory by `daysUntilBirthday(date, now) <= windowDays` (reuse
  the Phase-6 pure helper), return `{ personId, personName, label, date, inDays }[]`.

**Today feed (`src/server/today/feed.ts` + `src/server/data/today.ts`):**
- Add a `keyDate` `FeedItem` variant: `{ type: "keydate", personId, personName, label, date,
  inDays }`. `FeedSources` gains `keyDates`. `assembleTodayFeed` sorts key dates together with
  birthdays (by `inDays`). `getTodayData` calls `getUpcomingKeyDates`.

**Assistant capture (`src/server/ai/assistant.ts` + proposal flow):**
- Extend `interpretationSchema` with `proposedKeyDates: z.array(z.object({ label: z.string(),
  date: z.string() })).default([])` (the model returns an ISO date string; if the year is unknown
  it uses the current year — recurrence ignores the year). Update `INTERPRET_SYSTEM` to extract
  dates ("son's birthday March 3" → `{label:"son's birthday", date:"<year>-03-03"}`).
- `assistantSendAction` capture branch: include `proposedKeyDates` in the returned proposal.
  `ProposalCard` renders them; `applyProposal` (and `applyProposalAction`) create them via
  `addKeyDate` (ownership-checked, zod-validated server-side — coerce/validate the date; reject
  bad dates gracefully).

**UI:**
- Person card (`[id]/page.tsx` + a new `_components/key-dates.tsx`): a "Key dates" section listing
  each key date (label + formatted date, UTC) with delete, and an add form (label + date) →
  `addKeyDateAction`. Mirror the Facts section styling (Quiet Luxury).
- Home `feed-item-card.tsx`: render `keydate` items in the "Birthdays & dates" section with a
  deterministic greeting line (e.g. "Wish {personName} — {label} ({today | in N days})").

**Server actions (`src/app/(app)/people/actions.ts`):**
- `addKeyDateAction(personId, formData)` and `deleteKeyDateAction(keyDateId)` — `requireUser()`,
  zod-validate, guarded (typed error + log), `revalidatePath`.

**Telegram (`src/server/telegram/format.ts`):**
- The dates section lists upcoming key dates with the greeting line (escaped), alongside
  birthdays. Reuse the existing length-cap.

## Data flow
Key date stored (card or assistant-confirmed) → `getUpcomingKeyDates` (annual by month/day) →
Today feed "Birthdays & dates" + Telegram → user sees "Wish Maria — her son Andrii's birthday is
today" → acts. Deletion ownership-checked.

## Error handling
- All data access ownership-scoped; actions guarded (no raw 500), `logError` server-side.
- Assistant date extraction: invalid/missing dates are dropped (not persisted); a malformed
  proposed date fails zod validation in `applyProposal` and is skipped without crashing.
- Greeting text is deterministic + localized — never empty.

## Testing
- `keydates.ts`: add (ownership), delete (cross-user rejection), `getUpcomingKeyDates` window
  filter + userId scoping (mock prisma + reuse `daysUntilBirthday`).
- Today feed includes key dates within the window; assembly ordering.
- Assistant: interpret extracts `proposedKeyDates` (mocked); `applyProposal` creates key dates
  (ownership) and skips invalid dates.
- Telegram format includes key-date greeting lines (escaped).
- EN/UK parity for new copy; existing tests stay green.

## Out of scope
- Notifying ON the exact day via push (that's Phase C — native push). Phase B surfaces upcoming
  dates in the in-app feed + Telegram daily reminder.
- Age calculation/display (year is stored but not surfaced) — trivial future add.

## Acceptance
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity.
- You can add a key date on a person's card AND by telling the assistant ("his son's birthday is
  March 3" → proposed → confirm → saved).
- Upcoming key dates appear in the Today "Birthdays & dates" section (and Telegram) with a
  greeting reminder, recurring annually by month/day.
- Deletion + all access ownership-scoped; invalid dates handled gracefully; no secrets; pushed.
