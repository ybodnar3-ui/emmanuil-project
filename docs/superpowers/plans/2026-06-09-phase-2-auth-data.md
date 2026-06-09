# Phase 2 — Auth + Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax. Several integration APIs here are **version-sensitive** (Prisma 7
> driver adapters, `@supabase/ssr`). Where the plan says "verify against installed
> version", consult the official docs / installed package types and adapt the exact syntax
> — do not blindly copy if the installed version differs. Architectural decisions below are
> fixed; only the exact API wiring may adapt.

**Goal:** Add Supabase email auth (magic-link), a Prisma schema for all domain models, a
per-user-scoped server data-access layer, protected app routes, and RLS deny-by-default on
all tables as defense-in-depth.

**Architecture:**
- **Identity:** Supabase Auth (email magic-link / OTP) via `@supabase/ssr`, cookie-based
  sessions, refreshed in Next.js middleware. Google OAuth is deferred (note left in code).
- **Data isolation (KEY DECISION):** All app data access goes through **Prisma on the
  server, every query scoped by the authenticated user's id** (a `userId` column on every
  owned row, enforced by a thin data-access layer — never a raw unscoped query). This is
  the primary guard. As **defense-in-depth**, RLS is enabled on every table with
  **no permissive policies** (deny-by-default), so the public PostgREST/anon path can never
  read app data even if hit. Prisma connects via the pooler as `postgres` (server-only,
  bypasses RLS by design). Rationale: Prisma gives us typed queries + migrations; doing
  RLS-as-primary through Prisma would require per-request role/JWT switching that Prisma 7
  does not cleanly support. App-layer scoping + RLS lockdown is robust and standard.
- **User mirror:** Supabase owns `auth.users`. We keep a Prisma `User` row whose `id`
  equals the Supabase auth UID, upserted on each authenticated request (stores email,
  name, locale). All domain rows FK to `User.id`.
- **Prisma 7:** uses the `@prisma/adapter-pg` driver adapter (datasource url comes from
  `prisma.config.ts` for CLI; the runtime client is constructed with the adapter + a `pg`
  Pool). `pg` is already installed.

**Tech Stack:** Next.js 16 (App Router) · `@supabase/ssr` · `@supabase/supabase-js` ·
Prisma 7 + `@prisma/adapter-pg` + `pg` · Vitest. Supabase project already provisioned;
`.env` already holds `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Pre-flight (already done by the controller — do not redo)
- Supabase project `emmanuil` (ref `syuvmkohpofyqyxfrewy`, region ap-northeast-1) is live.
- `.env` is populated and git-ignored; connection verified against `aws-1-ap-northeast-1`
  pooler (port 6543 transaction = `DATABASE_URL`, 5432 session = `DIRECT_URL`).
- `pg` is installed (uncommitted in package.json/pnpm-lock — fold into your first commit).

---

## File Structure (created this phase)

- `prisma/schema.prisma` — all models (User, Person, Fact, Interaction, Cadence, Task, ChatMessage).
- `prisma/migrations/**` — generated migration + a raw-SQL step enabling RLS deny-by-default.
- `src/server/db.ts` — Prisma client singleton built with `@prisma/adapter-pg` + `pg` Pool.
- `src/server/supabase/server.ts` — server Supabase client (`createServerClient`, cookie adapter).
- `src/server/supabase/middleware.ts` — session-refresh helper used by root middleware.
- `src/middleware.ts` — Next.js middleware calling the session-refresh helper.
- `src/server/auth.ts` — `getCurrentUser()` (reads Supabase session, upserts Prisma User, returns it or null) + `requireUser()` (redirects to /login if absent).
- `src/server/data/people.ts` — example scoped data-access module (`listPeople(userId)` etc.) establishing the `forUser` pattern (full CRUD lands in Phase 3; this phase ships the pattern + one query used by a test).
- `src/app/login/page.tsx` — public magic-link sign-in form.
- `src/app/login/actions.ts` — server action: send magic link.
- `src/app/auth/confirm/route.ts` — OTP/magic-link callback handler (exchanges token, redirects).
- `src/app/auth/signout/route.ts` — sign-out handler.
- `src/app/(app)/layout.tsx` — protected layout (calls `requireUser()`), wraps the bottom-nav shell.
- Move existing tab pages under `src/app/(app)/`: `page.tsx` (Today), `people/`, `assistant/`, `settings/`.
- Tests: `src/server/data/__tests__/scoping.test.ts` (scoping helper), `src/server/__tests__/rls.test.ts` (RLS deny-by-default via anon key — integration, gated on env).

---

## Task 1: Prisma schema for all domain models

**Files:** `prisma/schema.prisma`

- [ ] **Step 1:** Write the full schema. All owned models carry `userId` + an index on it,
  and cascade-delete from `User`. Use this schema (adjust only if `prisma format` rejects a
  construct in the installed Prisma version):

```prisma
generator client {
  provider = "prisma-client-js"
}

// Prisma 7: connection url is configured in prisma.config.ts (CLI) and via the
// @prisma/adapter-pg driver adapter at runtime (see src/server/db.ts).
datasource db {
  provider = "postgresql"
}

model User {
  id           String        @id // equals Supabase auth UID
  email        String        @unique
  name         String?
  locale       String        @default("en")
  createdAt    DateTime      @default(now())
  people       Person[]
  tasks        Task[]
  chatMessages ChatMessage[]
}

model Person {
  id               String        @id @default(cuid())
  userId           String
  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  fullName         String
  photoUrl         String?
  howWeMet         String?
  location         String?
  birthday         DateTime?
  tags             String[]
  relationshipTier String?       // "vip" | "friend" | "acquaintance"
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  facts            Fact[]
  interactions     Interaction[]
  cadence          Cadence?
  tasks            Task[]
  chatMessages     ChatMessage[]

  @@index([userId])
}

model Fact {
  id        String   @id @default(cuid())
  personId  String
  person    Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  category  String   // "family" | "work" | "projects" | "interests" | "ask-about"
  content   String
  createdAt DateTime @default(now())

  @@index([personId])
}

model Interaction {
  id        String   @id @default(cuid())
  personId  String
  person    Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  date      DateTime @default(now())
  channel   String?  // "call" | "meeting" | "message"
  summary   String
  createdAt DateTime @default(now())

  @@index([personId])
}

model Cadence {
  id              String    @id @default(cuid())
  personId        String    @unique
  person          Person    @relation(fields: [personId], references: [id], onDelete: Cascade)
  intervalDays    Int
  lastContactedAt DateTime?
  nextDueAt       DateTime
}

model Task {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  personId  String?
  person    Person?   @relation(fields: [personId], references: [id], onDelete: SetNull)
  title     String
  dueAt     DateTime
  status    String    @default("todo") // "todo" | "done"
  note      String?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([dueAt])
}

model ChatMessage {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  personId  String?
  person    Person?  @relation(fields: [personId], references: [id], onDelete: SetNull)
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 2:** Validate: `pnpm db:format` exits 0 (no errors).

- [ ] **Step 3: Commit** (also folds in the already-installed `pg` dep):
```bash
git add -A
git commit -m "feat: Prisma schema for all domain models

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Prisma client with Prisma 7 driver adapter + first migration

**Files:** `src/server/db.ts`, `package.json` (scripts), `prisma/migrations/**`

- [ ] **Step 1:** Install the adapter (verify exact package name/version for the installed
  Prisma): `pnpm add @prisma/adapter-pg`. (`pg` already installed.)

- [ ] **Step 2:** Write `src/server/db.ts` — a Prisma client singleton built with the pg
  adapter. Verify the exact `PrismaPg`/adapter constructor signature against the installed
  `@prisma/adapter-pg` version; the shape is:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```
  If the installed Prisma requires `previewFeatures = ["driverAdapters"]` in the generator,
  add it and re-run `pnpm db:generate`.

- [ ] **Step 3:** Add scripts to `package.json`:
```json
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:studio": "prisma studio"
```

- [ ] **Step 4:** Create the first migration against the database (uses `DIRECT_URL` for
  migrations). Prisma reads the url from `prisma.config.ts`; ensure that config exposes the
  migration url (set it to `process.env.DIRECT_URL` for migrations if needed — verify).
  Run: `pnpm db:migrate --name init`
  Expected: migration created under `prisma/migrations/`, applied, "Your database is now in
  sync". Confirm tables exist (e.g. `pnpm db:studio` or a quick pg query).

- [ ] **Step 5:** Generate client: `pnpm db:generate` (exits 0).

- [ ] **Step 6: Commit:**
```bash
git add -A
git commit -m "feat: Prisma 7 pg driver adapter + initial migration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: RLS deny-by-default migration (defense-in-depth)

**Files:** a new migration `prisma/migrations/<ts>_enable_rls/migration.sql`

- [ ] **Step 1:** Create an empty migration to hold raw SQL:
  `pnpm exec prisma migrate dev --create-only --name enable_rls`

- [ ] **Step 2:** Put this SQL in the generated migration file (enables RLS on every app
  table; no policies are created → all access via the anon/PostgREST role is denied; the
  `postgres` role Prisma uses bypasses RLS):

```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cadence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Person" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Fact" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Cadence" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" FORCE ROW LEVEL SECURITY;
```
  NOTE on `FORCE`: this also subjects the table owner to RLS. Verify the role Prisma
  connects as is NOT the table owner (Supabase Prisma access typically connects as
  `postgres`, while tables are owned by the migration role) — if `FORCE` blocks Prisma,
  drop the `FORCE` lines and keep only `ENABLE` (ENABLE already blocks the anon path, which
  is the goal). Test in Step 4 and adjust.

- [ ] **Step 3:** Apply: `pnpm db:migrate` (or `prisma migrate dev`). Expected: applied cleanly.

- [ ] **Step 4:** Verify Prisma still reads/writes (it must). Quick check: a throwaway
  script that does `prisma.user.count()` returns a number without an RLS error. If it errors
  due to `FORCE`, remove the `FORCE` statements from the migration, re-create, re-apply.

- [ ] **Step 5: Commit:**
```bash
git add -A
git commit -m "feat: enable RLS deny-by-default on all tables (defense-in-depth)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Supabase server client + middleware session refresh

**Files:** `src/server/supabase/server.ts`, `src/server/supabase/middleware.ts`, `src/middleware.ts`

- [ ] **Step 1:** Install: `pnpm add @supabase/ssr @supabase/supabase-js`.

- [ ] **Step 2:** Write `src/server/supabase/server.ts` using `createServerClient` from
  `@supabase/ssr` with the Next 16 async `cookies()` adapter (verify the exact cookie
  adapter shape — `getAll`/`setAll` — against the installed `@supabase/ssr` version):

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — safe to ignore; middleware refreshes cookies
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3:** Write `src/server/supabase/middleware.ts` (`updateSession(request)` that
  refreshes the session and returns the response with updated cookies) and `src/middleware.ts`
  that calls it, with a `matcher` excluding static assets. Verify the `@supabase/ssr`
  middleware pattern for the installed version (request/response cookie plumbing).

- [ ] **Step 4:** Verify the app still builds and runs: `pnpm build`. Expected: exit 0.

- [ ] **Step 5: Commit:**
```bash
git add -A
git commit -m "feat: Supabase SSR server client + session-refresh middleware

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Auth helpers — getCurrentUser / requireUser (+ User upsert)

**Files:** `src/server/auth.ts`, `src/server/auth.test.ts` (pure-logic test)

- [ ] **Step 1:** Write `src/server/auth.ts`:
  - `getCurrentUser()`: get the Supabase user from the server client; if none, return null;
    if present, `prisma.user.upsert` (id = auth uid, email from auth, default locale "en")
    and return the Prisma `User`.
  - `requireUser()`: `const u = await getCurrentUser(); if (!u) redirect("/login"); return u;`
  - Export a pure helper `resolveDefaultLocale(authUserLocale?: string): string` returning a
    valid locale (reuse `normalizeLocale` from `@/i18n/locale`) — this is the unit-testable seam.

- [ ] **Step 2:** Write `src/server/auth.test.ts` testing `resolveDefaultLocale` /
  `normalizeLocale` integration (valid passthrough, fallback to "en"). Keep it pure — do not
  mock Supabase/Prisma here.

- [ ] **Step 3:** Run `pnpm test`. Expected: PASS.

- [ ] **Step 4: Commit:**
```bash
git add -A
git commit -m "feat: getCurrentUser/requireUser auth helpers with User upsert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Login flow — magic link send + callback + signout

**Files:** `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/auth/confirm/route.ts`, `src/app/auth/signout/route.ts`

- [ ] **Step 1:** `src/app/login/actions.ts` — `"use server"` action `sendMagicLink(formData)`:
  read email, call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <site>/auth/confirm } })`,
  return a success/error state. Verify `signInWithOtp` options against the installed SDK.

- [ ] **Step 2:** `src/app/login/page.tsx` — a public, mobile-first form (email input +
  submit) using the action; show "check your email" on success. All copy via `next-intl`
  keys; add the keys to `messages/en.json` and `messages/uk.json` (e.g. `auth.signIn`,
  `auth.emailLabel`, `auth.sendLink`, `auth.linkSent`, `auth.error`).

- [ ] **Step 3:** `src/app/auth/confirm/route.ts` — GET handler that reads the OTP
  `token_hash` + `type` (or `code`) from the URL, calls `supabase.auth.verifyOtp(...)` (or
  `exchangeCodeForSession`), then redirects to `/`. Verify the exact callback method for the
  installed `@supabase/ssr` (magic-link uses `verifyOtp` with `token_hash`).

- [ ] **Step 4:** `src/app/auth/signout/route.ts` — POST handler: `supabase.auth.signOut()`,
  redirect to `/login`.

- [ ] **Step 5:** Add a sign-out button to the Settings page wired to the signout route.

- [ ] **Step 6:** `pnpm build` exits 0; `pnpm lint` clean.

- [ ] **Step 7: Commit:**
```bash
git add -A
git commit -m "feat: magic-link login, auth callback, and sign-out

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Protected app route group + scoped data-access pattern

**Files:** move tab pages into `src/app/(app)/`; add `src/app/(app)/layout.tsx`,
`src/server/data/people.ts`, `src/server/data/__tests__/scoping.test.ts`

- [ ] **Step 1:** Create route group `src/app/(app)/` and MOVE the existing
  `page.tsx` (Today), `people/`, `assistant/`, `settings/` pages into it. The bottom-nav
  hrefs stay the same (route groups don't change URLs). Keep `/login` and `/auth/*` OUTSIDE
  the group (public).

- [ ] **Step 2:** `src/app/(app)/layout.tsx` — `async` layout that calls `await requireUser()`
  before rendering, then renders the children + `BottomNav` (move the nav from the root
  layout into this protected layout; the root layout keeps `<html>`/providers and now also
  serves the public `/login`). Ensure `/login` renders WITHOUT the bottom nav.

- [ ] **Step 3:** `src/server/data/people.ts` — establish the scoped pattern. Export
  `listPeople(userId: string)` → `prisma.person.findMany({ where: { userId }, orderBy: { fullName: "asc" } })`,
  and `createPerson(userId, data)` → always sets `userId`. Add a comment: "every owned-row
  query MUST be scoped by userId; never expose an unscoped query." (Full CRUD is Phase 3.)

- [ ] **Step 4:** `src/server/data/__tests__/scoping.test.ts` — test that `listPeople`
  builds a query `where: { userId }` for the given user and that `createPerson` injects the
  `userId` (mock the `prisma` module; assert the args passed). This verifies the isolation
  contract without a live DB.

- [ ] **Step 5:** `pnpm test` passes; `pnpm build` exits 0; manual gate: `pnpm dev`, visiting
  `/` while signed out redirects to `/login` (verify via `curl -I localhost:3000` → 307/302
  to /login).

- [ ] **Step 6: Commit:**
```bash
git add -A
git commit -m "feat: protected (app) route group + per-user scoped data-access pattern

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: RLS deny-by-default integration test + phase gate

**Files:** `src/server/__tests__/rls.test.ts`

- [ ] **Step 1:** Write `src/server/__tests__/rls.test.ts`: using `@supabase/supabase-js`
  with the **anon** key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), attempt `from("Person").select()`
  and assert it returns **no rows / an error** (RLS denies). Guard the test so it SKIPS if
  `NEXT_PUBLIC_SUPABASE_URL`/anon key are not set in the environment (so CI without secrets
  stays green). It should RUN locally where `.env` is present.

- [ ] **Step 2:** Run `pnpm test`. Expected: RLS test passes (denied) or skips if no env.

- [ ] **Step 3: Full phase gate:** `pnpm lint && pnpm test && pnpm build` all green.

- [ ] **Step 4: Push the phase:**
```bash
git push origin main
```

---

## Phase 2 Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- [ ] A user can request a magic link from `/login`, complete sign-in via the email link,
  land on `/`, and sign out from Settings.
- [ ] Visiting any `(app)` route while signed out redirects to `/login`.
- [ ] Prisma schema has all 7 models; migrations applied to Supabase; `prisma.user.count()`
  works through the pg driver adapter.
- [ ] RLS is enabled on all tables; the anon/PostgREST path cannot read `Person` (verified
  by test); Prisma server access still works.
- [ ] A scoped data-access module exists and its test proves queries are `userId`-scoped.
- [ ] `.env` secrets never committed; all work committed and pushed to `origin/main`.

## Carried-forward notes
- Google OAuth: deferred; leave a clear extension point in the login page/actions.
- Photo storage (Supabase Storage) lands in Phase 3 with Person CRUD.
- Full People/Fact/Interaction/Cadence/Task CRUD lands in Phase 3 on top of this layer.
