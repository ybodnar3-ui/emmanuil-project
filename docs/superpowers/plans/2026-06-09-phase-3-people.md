# Phase 3 — People + Person Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. The data layer,
> validation, cadence math, and ownership checks are **test-first**. UI pages use
> build/render verification gates. Follow the patterns already in the repo: shadcn/ui
> components, `next-intl` keys (EN + UK, no hardcoded copy), and the per-user-scoped data
> access established in Phase 2 (`src/server/data/people.ts`). Never write an unscoped query.

**Goal:** Full People management — create/read/update/delete people, a searchable/filterable
list, and a Person card with facts (grouped by category), an interaction timeline, contact
cadence, and an optional photo. This is the structured CRM core the AI phases build on.

**Architecture:**
- **Data layer** (`src/server/data/*`): typed functions, every one takes the authenticated
  `userId` and scopes/validates ownership. Nested entities (Fact/Interaction/Cadence) are
  reached only through a Person that belongs to the user — enforced by an `assertPersonOwned`
  helper. Prisma client from `src/server/db.ts`.
- **Validation:** `zod` schemas for all mutation inputs; server actions parse with zod and
  return typed error state.
- **Mutations:** Next.js server actions in `src/app/(app)/people/actions.ts`, each calling
  `requireUser()` then the data layer, then `revalidatePath`.
- **UI:** Server Components fetch via the data layer; Client Components only for interactive
  bits (search box, forms). Mobile-first, shadcn/ui.
- **Cadence:** pure `computeNextDueAt(from, intervalDays)` in `src/server/cadence.ts`
  (unit-tested); setting/updating cadence recomputes `nextDueAt`.
- **Photos:** a public Supabase Storage bucket `avatars`; upload via a server action using
  the service-role client; store the public URL in `Person.photoUrl`. Isolated as the last
  task so it can't block the CRUD core.

**Tech Stack:** Next.js 16 (App Router) · Prisma 7 + adapter-pg · zod · `@supabase/supabase-js`
(service-role, server-only, for Storage) · shadcn/ui · next-intl · Vitest.

---

## File Structure (created/modified this phase)

- `src/server/validation/person.ts` — zod schemas (person, fact, interaction, cadence input).
- `src/server/cadence.ts` — pure `computeNextDueAt` + interval presets.
- `src/server/data/people.ts` — EXTEND: `getPerson`, `updatePerson`, `deletePerson`, `searchPeople`, `assertPersonOwned`.
- `src/server/data/facts.ts` — `addFact`, `deleteFact`, `listFacts` (ownership-checked).
- `src/server/data/interactions.ts` — `logInteraction`, `listInteractions` (ownership-checked; logging an interaction also bumps cadence `lastContactedAt`/`nextDueAt`).
- `src/server/data/cadence.ts` — `setCadence`, `clearCadence` (ownership-checked).
- `src/server/storage.ts` — service-role Supabase client + `ensureAvatarsBucket()` + `uploadAvatar(userId, file)`.
- `src/app/(app)/people/actions.ts` — all server actions.
- `src/app/(app)/people/page.tsx` — list (search + tag/tier filter + Add button). (replaces the placeholder)
- `src/app/(app)/people/_components/people-search.tsx` — client search/filter control.
- `src/app/(app)/people/_components/person-form.tsx` — create/edit form (client).
- `src/app/(app)/people/new/page.tsx` — new person.
- `src/app/(app)/people/[id]/page.tsx` — Person card.
- `src/app/(app)/people/[id]/edit/page.tsx` — edit person.
- `src/app/(app)/people/[id]/_components/*` — fact form, interaction form, cadence form, delete button (client).
- shadcn primitives as needed: `input`, `textarea`, `label`, `card`, `select`, `badge`, `dialog`, `avatar` (add via `shadcn add`).
- Tests: `src/server/__tests__/cadence.test.ts`, `src/server/data/__tests__/ownership.test.ts`, extend `scoping.test.ts`, `src/server/validation/__tests__/person.test.ts`.
- i18n: extend `messages/en.json` + `messages/uk.json` with a `people.*` namespace.

---

## Task 1: Validation schemas + cadence math (pure, test-first)

**Files:** `src/server/validation/person.ts`, `src/server/cadence.ts`, `src/server/__tests__/cadence.test.ts`, `src/server/validation/__tests__/person.test.ts`

- [ ] **Step 1: Install zod:** `pnpm add zod`.

- [ ] **Step 2 (test-first): `src/server/__tests__/cadence.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { computeNextDueAt, INTERVAL_PRESETS } from "@/server/cadence";

describe("computeNextDueAt", () => {
  it("adds intervalDays to the from date (UTC)", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(computeNextDueAt(from, 14).toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(computeNextDueAt(from, 30).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
  it("rejects non-positive intervals", () => {
    expect(() => computeNextDueAt(new Date(), 0)).toThrow();
    expect(() => computeNextDueAt(new Date(), -5)).toThrow();
  });
  it("exposes presets 14/30/90/365", () => {
    expect(INTERVAL_PRESETS).toEqual([14, 30, 90, 365]);
  });
});
```

- [ ] **Step 3:** Implement `src/server/cadence.ts`:
```ts
export const INTERVAL_PRESETS = [14, 30, 90, 365] as const;

export function computeNextDueAt(from: Date, intervalDays: number): Date {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
    throw new Error("intervalDays must be a positive number");
  }
  return new Date(from.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: `src/server/validation/person.ts`** — zod schemas:
```ts
import { z } from "zod";

export const RELATIONSHIP_TIERS = ["vip", "friend", "acquaintance"] as const;
export const FACT_CATEGORIES = ["family", "work", "projects", "interests", "ask-about"] as const;
export const INTERACTION_CHANNELS = ["call", "meeting", "message"] as const;

export const personInputSchema = z.object({
  fullName: z.string().trim().min(1, "required").max(200),
  howWeMet: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  birthday: z.coerce.date().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).max(50).default([]),
  relationshipTier: z.enum(RELATIONSHIP_TIERS).optional().nullable(),
});
export type PersonInput = z.infer<typeof personInputSchema>;

export const factInputSchema = z.object({
  category: z.enum(FACT_CATEGORIES),
  content: z.string().trim().min(1).max(2000),
});

export const interactionInputSchema = z.object({
  date: z.coerce.date().optional(),
  channel: z.enum(INTERACTION_CHANNELS).optional().nullable(),
  summary: z.string().trim().min(1).max(4000),
});

export const cadenceInputSchema = z.object({
  intervalDays: z.coerce.number().int().positive().max(3650),
});
```

- [ ] **Step 5 (test): `src/server/validation/__tests__/person.test.ts`** — assert `personInputSchema`
  rejects empty `fullName`, accepts a minimal valid object, coerces `birthday` string→Date,
  and `cadenceInputSchema` rejects 0/negative. Write ~5 focused cases.

- [ ] **Step 6:** `pnpm test` → PASS. **Commit:** `feat: cadence math + zod validation schemas`.

---

## Task 2: Data layer — people CRUD + ownership (test-first on scoping)

**Files:** EXTEND `src/server/data/people.ts`; `src/server/data/__tests__/ownership.test.ts`; extend `scoping.test.ts`

- [ ] **Step 1:** Add to `src/server/data/people.ts` (keep existing `listPeople`/`createPerson`):
```ts
import { prisma } from "@/server/db";
import type { PersonInput } from "@/server/validation/person";

export async function assertPersonOwned(userId: string, personId: string) {
  const person = await prisma.person.findFirst({ where: { id: personId, userId } });
  if (!person) throw new Error("Person not found");
  return person;
}

export async function getPerson(userId: string, personId: string) {
  return prisma.person.findFirst({
    where: { id: personId, userId },
    include: {
      facts: { orderBy: { createdAt: "desc" } },
      interactions: { orderBy: { date: "desc" } },
      cadence: true,
    },
  });
}

export async function updatePerson(userId: string, personId: string, data: PersonInput) {
  await assertPersonOwned(userId, personId);
  return prisma.person.update({ where: { id: personId }, data });
}

export async function deletePerson(userId: string, personId: string) {
  await assertPersonOwned(userId, personId);
  return prisma.person.delete({ where: { id: personId } });
}

export async function searchPeople(
  userId: string,
  opts: { query?: string; tag?: string; tier?: string } = {},
) {
  return prisma.person.findMany({
    where: {
      userId,
      ...(opts.query ? { fullName: { contains: opts.query, mode: "insensitive" } } : {}),
      ...(opts.tag ? { tags: { has: opts.tag } } : {}),
      ...(opts.tier ? { relationshipTier: opts.tier } : {}),
    },
    orderBy: { fullName: "asc" },
  });
}
```
  Also update `createPerson` to accept the full `PersonInput`.

- [ ] **Step 2 (test): `ownership.test.ts`** — mock `@/server/db`; assert `getPerson`,
  `updatePerson`, `deletePerson`, `searchPeople` all include `userId` in their Prisma
  `where`; assert `updatePerson`/`deletePerson` call `assertPersonOwned` first (i.e. a
  `findFirst({ where: { id, userId } })` happens before the mutation), and that
  `assertPersonOwned` throws when `findFirst` resolves null. Extend `scoping.test.ts` if needed.

- [ ] **Step 3:** `pnpm test` → PASS. **Commit:** `feat: people CRUD data layer with ownership scoping`.

---

## Task 3: Data layer — facts, interactions, cadence (ownership-checked)

**Files:** `src/server/data/facts.ts`, `src/server/data/interactions.ts`, `src/server/data/cadence.ts`; extend `ownership.test.ts`

- [ ] **Step 1: `facts.ts`** — `addFact(userId, personId, input)` and `deleteFact(userId, factId)`.
  `addFact` calls `assertPersonOwned(userId, personId)` then `prisma.fact.create`. `deleteFact`
  loads the fact with its person and verifies `fact.person.userId === userId` before delete.

- [ ] **Step 2: `interactions.ts`** — `logInteraction(userId, personId, input)`:
  `assertPersonOwned`, create the Interaction, AND if the person has a Cadence, update its
  `lastContactedAt` to the interaction date and `nextDueAt = computeNextDueAt(date, intervalDays)`.
  Do the create + cadence update in a `prisma.$transaction`. Also `listInteractions(userId, personId)`.

- [ ] **Step 3: `cadence.ts`** — `setCadence(userId, personId, intervalDays)`:
  `assertPersonOwned`, then upsert Cadence with `nextDueAt = computeNextDueAt(lastContactedAt ?? now, intervalDays)`.
  `clearCadence(userId, personId)`: `assertPersonOwned` then delete. (Pass `now` in as a param
  default so it stays testable; do not call Date.now() in a way that breaks tests.)

- [ ] **Step 4 (test):** extend `ownership.test.ts` — for each function assert
  `assertPersonOwned` is invoked (ownership gate) and the cadence bump logic in
  `logInteraction` computes `nextDueAt` from the interaction date + interval (mock prisma + a
  fixed date). Verify `deleteFact` rejects a fact whose `person.userId` differs.

- [ ] **Step 5:** `pnpm test` → PASS. **Commit:** `feat: facts/interactions/cadence data layer`.

---

## Task 4: Server actions (zod-validated, auth-gated)

**Files:** `src/app/(app)/people/actions.ts`

- [ ] **Step 1:** Implement `"use server"` actions, each: `const user = await requireUser();`
  → `schema.parse`/`safeParse` the FormData → call the data-layer fn with `user.id` →
  `revalidatePath`. Actions: `createPersonAction`, `updatePersonAction`, `deletePersonAction`,
  `addFactAction`, `deleteFactAction`, `logInteractionAction`, `setCadenceAction`,
  `clearCadenceAction`. Return a typed `{ status: "ok" | "error"; message?: string; fieldErrors?: ... }`
  state for form actions; `deletePersonAction` redirects to `/people` on success.
  Parse `tags` from a comma-separated input string into `string[]`.

- [ ] **Step 2:** `pnpm build` (exit 0), `pnpm lint` (clean). **Commit:** `feat: people server actions with zod validation`.

---

## Task 5: People list page (search + filter + add)

**Files:** `src/app/(app)/people/page.tsx`, `src/app/(app)/people/_components/people-search.tsx`; add shadcn `input`, `badge`, `select`, `card`, `avatar`.

- [ ] **Step 1:** Add shadcn primitives: `pnpm dlx shadcn@latest add input badge select card avatar label textarea`.

- [ ] **Step 2:** `page.tsx` (Server Component): read `searchParams` (`q`, `tag`, `tier`),
  `const user = await requireUser();` then `searchPeople(user.id, ...)`. Render a header with
  an "Add person" link to `/people/new`, the `<PeopleSearch/>` control, and a list of person
  rows (avatar/initials, name, tier badge, tags). Empty state uses `people.empty` key. Each
  row links to `/people/[id]`.

- [ ] **Step 3:** `people-search.tsx` (Client Component): a search input + tier `<Select>` +
  optional tag filter that updates the URL query (`router.replace` with `useSearchParams`),
  debounced. All labels via next-intl.

- [ ] **Step 4:** `pnpm build` exits 0. Manual gate: with a signed-in session (or temporarily
  seed a Person via Prisma for visual check, then remove), `/people` lists people and search
  filters them. **Commit:** `feat: people list with search and filters`.

---

## Task 6: New / Edit person form

**Files:** `src/app/(app)/people/_components/person-form.tsx`, `src/app/(app)/people/new/page.tsx`, `src/app/(app)/people/[id]/edit/page.tsx`

- [ ] **Step 1:** `person-form.tsx` (Client Component, `useActionState`): fields fullName,
  howWeMet, location, birthday (date input), tags (comma-separated text), relationshipTier
  (select). Takes an optional `initial` person + the action to call; shows field errors from
  the action's returned state. Submit label/strings via next-intl.

- [ ] **Step 2:** `new/page.tsx`: renders `<PersonForm action={createPersonAction} />`.

- [ ] **Step 3:** `[id]/edit/page.tsx`: `requireUser()`, `getPerson`, 404 via `notFound()` if
  missing, render `<PersonForm initial={person} action={updatePersonAction.bind(null, person.id)} />`.

- [ ] **Step 4:** `pnpm build` exits 0. **Commit:** `feat: create/edit person form`.

---

## Task 7: Person card page

**Files:** `src/app/(app)/people/[id]/page.tsx`, `src/app/(app)/people/[id]/_components/{fact-form,interaction-form,cadence-form,delete-person-button}.tsx`

- [ ] **Step 1:** `[id]/page.tsx` (Server Component): `requireUser()`, `getPerson(user.id, id)`,
  `notFound()` if null. Render: header (avatar, name, tier, location, birthday, edit + delete),
  **Facts** grouped by `FACT_CATEGORIES` (each with an add-fact control + per-fact delete),
  **Cadence** (current interval + next-due, set/clear control), **Interactions** timeline
  (date, channel, summary) + a "Log interaction" control. The "What do I know?" AI button is a
  Phase 4 placeholder — leave a clearly-labeled disabled button or omit (do NOT build AI here).

- [ ] **Step 2:** The `_components` client forms wire to the Task 4 actions via `useActionState`,
  each `revalidate`s the card. `delete-person-button.tsx` confirms then calls `deletePersonAction`.

- [ ] **Step 3:** `pnpm build` exits 0. Manual gate: create a person, open the card, add a fact,
  log an interaction (verify it appears + cadence next-due moves), set cadence, delete. **Commit:**
  `feat: person card with facts, interactions, and cadence`.

---

## Task 8: Photo upload (Supabase Storage) — isolated last

**Files:** `src/server/storage.ts`; extend `person-form.tsx` + `actions.ts`

- [ ] **Step 1:** `src/server/storage.ts`: a server-only Supabase client built with
  `SUPABASE_SERVICE_ROLE_KEY`; `ensureAvatarsBucket()` (idempotent create of a public bucket
  `avatars`); `uploadAvatar(userId, file): Promise<string>` that uploads to `avatars/<userId>/<id>`
  and returns the public URL. Verify the storage API method names against the installed
  `@supabase/supabase-js`.

- [ ] **Step 2:** Add an optional photo `<input type="file">` to `person-form.tsx`; in
  `createPersonAction`/`updatePersonAction`, if a file is present, call `ensureAvatarsBucket()`
  then `uploadAvatar` and set `photoUrl`. Keep upload failures non-fatal to the rest of the save
  (report a field-level message; don't lose the other fields).

- [ ] **Step 3:** Show the photo as the person's avatar on the list and card (fallback to initials).

- [ ] **Step 4:** `pnpm build` exits 0. Manual gate: upload a photo on create/edit; it renders
  on the card and list. **Commit:** `feat: person photo upload via Supabase Storage`.

---

## Task 9: i18n + phase gate

- [ ] **Step 1:** Ensure every new user-facing string is a `people.*` key in BOTH
  `messages/en.json` and `messages/uk.json`. Grep the new `src/app/(app)/people` files for any
  hardcoded English copy and replace with keys. Provide natural Ukrainian translations.

- [ ] **Step 2: Full gate:** `pnpm lint && pnpm test && pnpm build` all green.

- [ ] **Step 3: Push:** `git push origin main`.

---

## Phase 3 Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- [ ] A signed-in user can create, edit, and delete a person; the list shows their people and
  supports search by name + filter by tag/tier.
- [ ] The Person card shows facts grouped by category, an interaction timeline, and cadence;
  the user can add/delete facts, log interactions, and set/clear cadence.
- [ ] Logging an interaction advances the cadence `nextDueAt` (cadence math unit-tested).
- [ ] All data access is scoped to the authenticated user; nested entities are ownership-checked
  (unit-tested) — no cross-user access path.
- [ ] Optional photo upload works (Supabase Storage `avatars` bucket) and renders as avatar.
- [ ] All new copy is in EN + UK via next-intl keys; no hardcoded strings.
- [ ] `.env`/secrets never committed; all work committed and pushed to `origin/main`.

## Carried-forward notes
- AI brief ("What do I know?") is Phase 4 — only a placeholder here.
- Storage bucket RLS hardening (per-user folders) can be tightened later; MVP uses a public
  read bucket with server-side (service-role) writes.
