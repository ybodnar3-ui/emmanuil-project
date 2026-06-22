# Error Monitoring (Item #5, Vercel-native) — Design Spec

**Date:** 2026-06-22 · **Status:** Approved (design). Gives the app real error visibility without a
third-party vendor: server errors already flow to Vercel logs; this adds a lightweight bridge so
**client (browser) errors land in the same Vercel logs**.

## Decision (from brainstorming)
- **Vercel-native, no Sentry / no new vendor or account.** Server errors are already captured:
  `logError` writes one structured JSON line to `console.error`, which Vercel collects in
  Logs / Observability. The blind spot is the browser — Vercel never sees client-side JS errors.
- **Full option chosen:** add a tiny client-error bridge so browser crashes also reach Vercel logs.

## Architecture & components

**1. Bridge endpoint — `src/app/api/client-error/route.ts` (new):**
- `POST` handler, public (errors happen on `/login` too, pre-auth), Node runtime.
- Reads the request body with a hard size cap (ignore bodies over ~8 KB → respond 204 without
  logging, so it can't be used to flood logs with huge payloads).
- Validates with zod: `{ message: string (≤1000, truncated), stack?: string (≤4000, truncated),
  url?: string (≤500), scope?: string (≤50), digest?: string (≤100) }`. Invalid → 400, no throw.
- On success: `logError("client", new Error(message), { scope, url, digest })` and return 204.
- Never throws to the caller; never touches the DB; carries no secrets.

**2. Reporter helper — `src/lib/client-error.ts` (new, browser-only):**
- `reportClientError(error: unknown, scope: string): void` — builds `{ message, stack, url, scope }`
  (truncated client-side too), `fetch("/api/client-error", { method: "POST", keepalive: true,
  headers, body })`, and swallows ALL failures (the reporter must never throw or surface to the
  user). No-ops during SSR (guards on `typeof window`).

**3. Global listener — `src/app/_components/client-error-reporter.tsx` (new, `"use client"`):**
- A component that renders `null` and, on mount, registers `window.addEventListener("error", …)`
  and `("unhandledrejection", …)` → `reportClientError(…, "window")` / `"unhandledrejection")`,
  removing them on unmount. Mounted once in the root layout (`src/app/layout.tsx`) so it covers
  uncaught errors and rejected promises outside React's render path.

**4. Wire the existing error boundaries:** in `src/app/global-error.tsx`,
`src/app/error.tsx`, and `src/app/(app)/error.tsx`, call `reportClientError(error, "<boundary>")`
inside the existing `useEffect` alongside the current `console.error(error)`. (These catch React
render crashes — the main client failure mode.) The boundaries stay client components; the reporter
is client-safe (it does NOT import the server-only `logError`).

## Data flow
Browser error (render crash via boundary, or uncaught/rejection via the global listener) →
`reportClientError` → `POST /api/client-error` → `logError("client", …)` → structured
`console.error` line → Vercel Logs / Observability. Server errors continue to flow directly through
`logError` as today (no change).

## Where to view
Vercel dashboard → the project → **Logs** (and **Observability**). Client errors appear as JSON
lines with `"scope":"client"` (or `"window"`/`"unhandledrejection"`). Document this in `README.md` /
`HANDOFF.md`. (Log Drains to an external store are a paid Vercel feature — out of scope.)

## Error handling
- The reporter never throws (best-effort `fetch`, all failures swallowed) — monitoring must never
  break the app.
- The endpoint never throws: oversized → 204 (silently dropped), invalid → 400, valid → 204.
- No new failure mode is introduced for end users.

## Security / privacy
- Public endpoint, but it only writes to server logs (no DB, no secrets, no auth state). Hard body-
  size cap + per-field truncation bound abuse and log volume. No per-IP rate limiting (serverless;
  the size cap is the mitigation) — noted as a future hardening if abuse appears.
- Error messages/stacks may incidentally contain app text; they go only to our server logs (same
  trust boundary as existing `logError`), never back to other users.

## Testing
- Route: valid payload → 204 and `logError` called with scope `"client"` and the right meta;
  invalid JSON / missing message → 400, no throw; oversized body → 204 without calling `logError`.
- Reporter: builds the payload and truncates; never throws when `fetch` rejects (mock a rejecting
  fetch); no-ops when `window` is undefined.
- Existing tests stay green; lint/build pass. No i18n change (boundaries already localized;
  `global-error` stays English by design).

## Out of scope
- Sentry / any third-party error aggregator; performance tracing, session replay.
- Source-map upload, per-IP rate limiting, Log Drains to an external store.
- Alerting rules (Vercel free tier) — viewing is via the dashboard.

## Acceptance
- `pnpm lint`, `pnpm test`, `pnpm build` green.
- Server errors continue to reach Vercel logs (unchanged); browser errors — both React render
  crashes (via the error boundaries) and uncaught errors / unhandled rejections (via the global
  listener) — now POST to `/api/client-error` and appear in Vercel logs with a `client`/`window`
  scope.
- The reporter and endpoint never throw; no DB change; no secrets; pushed to `main`.
