# Hardening Pass — Error Handling + Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Checkbox (`- [ ]`) steps. Driven by the audit at
> `docs/superpowers/plans/` (2026-06-13). Follow existing conventions: next-intl EN+UK keys
> (keep parity — a parity test enforces it), scoped data layer, no-throw/no-leak on anything
> client-facing, no secrets in logs that reach the client.

**Goal:** Make the MVP resilient: (1) catch failures that currently produce raw 500s, (2) add
typed error handling to the server actions that still throw, (3) add server-only structured
logging so failures are observable, (4) make the one cryptic config seam (Supabase env) fail
with a clear message. `.env` safety is already verified — no change needed there.

**Already robust (DO NOT redo):** the AI layer (brief/assistant/suggest — wrapped, no-leak),
`today/actions.ts` markContacted/snoozeContact/createTask, `assistant/actions.ts`
applyProposal, storage upload (non-fatal), date validation, env fail-fast for
DATABASE_URL/ANTHROPIC_API_KEY/service-role, auth redirect sanitization, client components'
error UI. The gaps below are what's left.

**Tech:** Next.js 16 App Router (error/not-found conventions), next-intl, Vitest. No new deps.

---

## Task 1: Server-only structured logger

**Files:** `src/server/log.ts`, `src/server/__tests__/log.test.ts`

- [ ] **Step 1:** `src/server/log.ts` — a tiny server-only logger. It writes ONE structured
  JSON line to `console.error` (server logs only — never returned to the client). It must be
  safe to pass any error; it extracts `message`/`name`/`code` (and `stack` in non-production)
  but never assumes shape. Add a header comment: server-only; do not import from client
  components; callers must still return stable error codes to the UI (logging ≠ leaking).
```ts
type Meta = Record<string, string | number | boolean | null | undefined>;

export function logError(scope: string, err: unknown, meta?: Meta): void {
  const base = err instanceof Error
    ? { message: err.message, name: err.name, ...(typeof (err as { code?: unknown }).code === "string" ? { code: (err as { code: string }).code } : {}) }
    : { message: String(err) };
  const entry = {
    level: "error",
    scope,
    ...base,
    ...(meta ?? {}),
    ...(process.env.NODE_ENV !== "production" && err instanceof Error ? { stack: err.stack } : {}),
  };
  // server-only sink; structured for log aggregators
  console.error(JSON.stringify(entry));
}
```

- [ ] **Step 2 (test):** `log.test.ts` — spy on `console.error` (vi.spyOn); assert `logError`
  emits valid JSON containing `scope`, the error `message`, and any `meta`; assert it does NOT
  throw when given a non-Error (string/object/null); restore the spy.

- [ ] **Step 3:** `pnpm test` → PASS. Commit: `feat: server-only structured error logger`.

---

## Task 2: Add logError to existing silent server-side catches

**Files:** `src/server/ai/brief.ts`, `assistant.ts`, `suggest.ts`; `src/app/(app)/assistant/actions.ts`; `src/app/(app)/today/actions.ts`; `src/app/(app)/people/actions.ts` (photo catch); `src/app/login/actions.ts`; `src/app/auth/confirm/route.ts`; `src/app/auth/signout/route.ts`

- [ ] **Step 1:** In each currently-silent server-side `catch`, call
  `logError("<scope>", err, {...minimal safe meta})` BEFORE returning the stable code / redirect.
  Bind the error variable (`catch (err)`) where it's currently bare. Scopes: `ai.brief`,
  `ai.assistant.interpret`, `ai.assistant.answer`, `ai.suggest`, `action.applyProposal`,
  `action.markContacted`, `action.snoozeContact`, `action.createTask`, `action.photoUpload`,
  `auth.signInWithOtp`, `auth.verifyOtp`, `auth.signOut`. Do NOT change the returned client
  result (still the stable code — no provider text/key to the client). Logging the raw
  `err.message` server-side is fine (server logs are not client-visible).
  - Leave `src/server/supabase/server.ts:21` cookie-setter catch silent (it's a legitimate RSC
    no-op) — optionally add a one-line comment, no log.
  - `login/actions.ts`: also log the Supabase `error` object when `signInWithOtp` returns an
    error (it returns `{error}`, doesn't throw) and keep the generic `{status:"error"}`.
  - `auth/confirm/route.ts`: log the verifyOtp error, then redirect to `/login?error=expired`
    (add handling below). `auth/signout/route.ts`: capture `signOut()`'s returned error and log
    it if present; still redirect to `/login`.

- [ ] **Step 2:** `pnpm lint` + `pnpm build` green. Commit: `feat: log server-side failures before returning stable codes`.

---

## Task 3: Guard the unguarded people server actions

**Files:** `src/app/(app)/people/actions.ts` (+ test `src/app/(app)/people/__tests__/actions-errors.test.ts`)

- [ ] **Step 1:** Wrap the throwing data-layer calls (these all start with `assertPersonOwned`,
  which throws on a stale/deleted id) so a throw becomes a typed result + a log, matching the
  pattern already used in `today/actions.ts`:
  - `createPersonAction`, `updatePersonAction`: wrap `createPerson`/`updatePerson`(+photo); on
    throw → `logError("action.<name>", err, {userId})` then return `{ status: "error", message: "people.errors.saveFailed" }`. Keep zod field-validation behavior unchanged (runs before the data call).
  - `addFactAction`, `logInteractionAction`, `setCadenceAction`: wrap the data call; on throw →
    log + return `{ status: "error", message: "people.errors.notFound" }`.
  - `deletePersonAction`, `clearCadenceAction` (return `void`/redirect): wrap; on throw, treat as
    idempotent (log it, then `revalidatePath`/`redirect` as success — the row is already gone).
  `requireUser()` stays OUTSIDE the try (an auth failure should still redirect, not be caught).

- [ ] **Step 2:** Add i18n keys `people.errors.saveFailed` and (if missing) `people.errors.notFound`
  to BOTH `messages/en.json` + `messages/uk.json` (natural Ukrainian, keep parity). Ensure the
  forms (`person-form.tsx`, fact/interaction/cadence forms) render `message`/the error state
  (most already render a generic error — verify the new `message` codes surface).

- [ ] **Step 3 (test):** `actions-errors.test.ts` — mock the people data layer so the relevant
  fn throws; assert each wrapped action returns `{status:"error", ...}` (not a thrown error) and
  that `logError` was called (spy/mock `@/server/log`). Mock `requireUser`/`revalidatePath`/`redirect`
  as needed. Cover at least createPerson(save fail), addFact(not found), deletePerson(idempotent).

- [ ] **Step 4:** `pnpm test` + `pnpm lint` + `pnpm build` green. Commit:
  `fix: guard people server actions against data-layer throws + log`.

---

## Task 4: Align the two today task actions (consistency)

**Files:** `src/app/(app)/today/actions.ts`

- [ ] **Step 1:** Wrap `completeTaskAction` and `snoozeTaskAction` data calls in try/catch
  returning `{ status: "error" as const, message: "NOT_FOUND" }` + `logError` — matching the
  other today actions (the underlying `updateMany` is no-op-safe, but this aligns the contract
  and adds logging). Verify the feed-item-card error path handles the result.

- [ ] **Step 2:** `pnpm test` + `pnpm lint` + `pnpm build` green. Commit:
  `refactor: align today task actions with guarded+logged error contract`.

---

## Task 5: Error boundaries + not-found

**Files:** `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/people/[id]/not-found.tsx`, i18n keys

- [ ] **Step 1:** `src/app/(app)/error.tsx` (`"use client"`): renders inside the root layout, so
  `NextIntlClientProvider` IS in scope — use `useTranslations("errors")`. Show a friendly
  "couldn't load — try again" with a `reset()` button. Accepts `{ error, reset }`. Call
  `logError` is server-only — DON'T import it here; instead `useEffect(() => console.error(error), [error])`
  for client-side visibility.
- [ ] **Step 2:** `src/app/error.tsx` (`"use client"`): same shape, root-segment fallback (also
  within the root layout/provider). Keep it simple.
- [ ] **Step 3:** `src/app/global-error.tsx` (`"use client"`): replaces the root layout entirely
  → must render its own `<html><body>`, and there is NO i18n provider here → use plain English
  text ("Something went wrong" + retry). This only fires if the root layout itself throws.
- [ ] **Step 4:** `src/app/(app)/people/[id]/not-found.tsx`: a styled "person not found → back to
  People" (server component; can use `getTranslations`). Covers the `notFound()` calls.
- [ ] **Step 5:** Add an `errors.*` namespace (`title`, `description`, `retry`, `backToPeople`,
  `notFoundTitle`) to BOTH en.json + uk.json (natural Ukrainian, parity).
- [ ] **Step 6:** `pnpm lint` + `pnpm build` green. Manual gate (optional): temporarily throw in
  a page to confirm the boundary renders, then revert. Commit: `feat: add error boundaries and not-found pages`.

---

## Task 6: Supabase env fail-fast + auth error hint + phase gate

**Files:** `src/server/supabase/server.ts`, `src/server/supabase/middleware.ts`, `src/app/login/page.tsx`

- [ ] **Step 1:** Replace the `NEXT_PUBLIC_SUPABASE_URL!` / `NEXT_PUBLIC_SUPABASE_ANON_KEY!`
  non-null assertions (in `supabase/server.ts` and `supabase/middleware.ts`) with an explicit
  guard at point-of-use (inside the function, so it's per-request not import-time): if either is
  missing, `throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY is not set")` (clear message,
  caught by the new error boundary instead of a cryptic deep `@supabase/ssr` failure). A small
  local `requireEnv(name)` helper is fine.
- [ ] **Step 2:** `login/page.tsx`: read `searchParams.error` (Next 16 → it's a Promise, await
  it); if `error === "expired"`, show a localized hint (`auth.linkExpired`) above the form. Add
  the key to en+uk.
- [ ] **Step 3: Full gate:** `pnpm lint && pnpm test && pnpm build` all green; EN/UK parity test
  passes.
- [ ] **Step 4: Push:** `git push origin main`.

---

## Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass; EN/UK parity holds.
- [ ] A server-only `logError` exists and is called in every previously-silent server-side
  catch and in the login/auth routes (server logs only; never returns provider text/keys to the
  client).
- [ ] Every mutating server action returns a typed `{status:"error"}` (or idempotent redirect)
  instead of throwing a raw 500 on a stale/deleted id or DB blip (people actions + today task
  actions wrapped; verified by tests).
- [ ] `error.tsx` (root + `(app)`), `global-error.tsx`, and `people/[id]/not-found.tsx` exist;
  a DB-down page render or an uncaught action throw shows a friendly ret​ry UI, not Next's raw
  error page.
- [ ] Missing Supabase env vars fail with a clear message (caught by the boundary), not a
  cryptic deep error.
- [ ] `.env` remains untracked/never-committed (already verified — no change).
- [ ] All committed and pushed to `origin/main`; no secrets committed.

## Carried-forward
- Sending logs to a real aggregator (Sentry/Logtail) is post-MVP; `logError`'s console.error
  sink is the seam to swap later.
- Rate-limit-specific messaging on auth (429) can be refined later.
