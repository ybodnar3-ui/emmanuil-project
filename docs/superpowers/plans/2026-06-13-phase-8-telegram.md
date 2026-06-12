# Phase 8 — Telegram Notifications + Deploy Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Checkbox (`- [ ]`) steps. Conventions: scoped data layer +
> ownership, `requireUser()`, next-intl EN+UK keys (parity test must stay green), server-only
> secrets, no-throw/no-leak on anything client/network-facing, server-only `logError` in
> catches. **Any Anthropic code: invoke the `claude-api` skill** (none expected this phase).

**Goal:** Deliver the proactive **phone notifications** the client specifically asked for —
a Telegram bot that DMs the user their daily "who to contact / birthdays / due tasks", plus
make the app **deploy-ready on Vercel** (Prisma generate on build, a daily cron, documented
env). All Telegram code is **token-gated**: it builds and tests without a token and degrades
cleanly; it goes live once a `TELEGRAM_BOT_TOKEN` + webhook are configured after deploy.

**Architecture:**
- **Link flow:** Settings shows "Connect Telegram". A server action mints a random one-time
  `linkCode` stored on the user; the UI shows a `t.me/<bot>?start=<code>` deep link. When the
  user opens it and taps Start, Telegram calls our **webhook** with `/start <code>`; we match
  the code → store the user's `telegramChatId` → clear the code → reply "Connected".
- **Reminders:** a daily **Vercel cron** hits `/api/cron/reminders` (protected by `CRON_SECRET`
  via the `Authorization: Bearer` header Vercel sends). For each user with a linked chat, it
  computes that user's Today feed (reuse `getTodayFeed`), and if non-empty, formats a message
  (pure, tested, localized) and sends it via the Bot API. No-throw/no-leak; per-user failures
  are logged and don't abort the run.
- **Security:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` are server-only.
  The webhook verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header. The cron verifies
  `CRON_SECRET`. Link codes are random, one-time, and cleared on use.

**Tech:** Next.js 16 route handlers, Prisma 7, Bot API over `fetch` (no SDK needed), zod,
Vitest. No new heavy deps.

---

## Task 1: Schema — Telegram link fields + migration

**Files:** `prisma/schema.prisma`, `prisma/migrations/**`, `.env.example`

- [ ] **Step 1:** Add to `model User`: `telegramChatId String? @unique` and
  `telegramLinkCode String? @unique`. (Additive, nullable — safe.)
- [ ] **Step 2:** `pnpm db:format`; create + apply migration:
  `pnpm exec prisma migrate dev --name telegram_link` (runs over DIRECT_URL). Confirm applied.
- [ ] **Step 3:** Add to `.env.example` (and as empty placeholders in local `.env` so nothing
  breaks): `TELEGRAM_BOT_TOKEN=""`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=""`,
  `TELEGRAM_WEBHOOK_SECRET=""`, `CRON_SECRET=""`. Document each with a one-line comment.
- [ ] **Step 4:** Commit: `feat: add Telegram link fields to User schema`.

---

## Task 2: Telegram client + pure message formatting (test-first)

**Files:** `src/server/telegram/client.ts`, `src/server/telegram/format.ts`, `src/server/telegram/__tests__/format.test.ts`

- [ ] **Step 1:** `client.ts` — server-only Bot API helpers, token-gated, no-throw/no-leak:
```ts
import { logError } from "@/server/log";
const API = "https://api.telegram.org";
export function telegramConfigured(): boolean { return Boolean(process.env.TELEGRAM_BOT_TOKEN); }
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { logError("telegram.send", new Error("TELEGRAM_BOT_TOKEN not set")); return false; }
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) { logError("telegram.send", new Error(`HTTP ${res.status}`), { chatId }); return false; }
    return true;
  } catch (err) { logError("telegram.send", err, { chatId }); return false; }
}
```
  (Never log the token; never throw.)

- [ ] **Step 2 (test-first):** `format.test.ts` for a pure `formatReminderMessage(feed, locale)`
  in `format.ts` that turns a `FeedItem[]` (from `src/server/today/feed.ts`) into a Telegram
  HTML string. Cases: contacts/birthdays/tasks each render a line; empty feed → returns null
  (caller skips sending); HTML-escapes person/task text (no injection via a name like
  `<b>x</b>`); localized header (EN/UK). Then implement `format.ts` to pass. Keep it pure (no
  network, no Date.now — take `now`/labels in).

- [ ] **Step 3:** Commit: `feat: Telegram client + pure reminder message formatter`.

---

## Task 3: Link flow — server action + webhook

**Files:** `src/server/data/telegram.ts`, `src/app/(app)/settings/actions.ts` (or extend existing), `src/app/(app)/settings/_components/connect-telegram.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1:** `src/server/data/telegram.ts` (scoped): `setLinkCode(userId, code)` (store code,
  clear any existing chat link or keep — keep existing chat), `linkChatByCode(code, chatId)`
  (find user by `telegramLinkCode === code`; if found set `telegramChatId = chatId`, null the
  code; return boolean), `unlinkTelegram(userId)`. Use a crypto-random code generator (e.g.
  `randomBytes(8).toString("hex")`) — pass it in or generate in the action (Date/random caveat:
  this is server runtime, fine; just don't put randomness in a unit-tested pure fn).
- [ ] **Step 2:** Settings server action `connectTelegramAction()`: `requireUser()` → generate
  code → `setLinkCode(user.id, code)` → return `{ status:"ok", url: t.me/<username>?start=<code> }`
  using `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`; if username/token not configured, return
  `{ status:"error", message:"telegram.notConfigured" }`. Also `disconnectTelegramAction()`.
- [ ] **Step 3:** `connect-telegram.tsx` (client) on Settings: shows current state
  (Connected / Not connected — read `user.telegramChatId` server-side and pass in), a "Connect
  Telegram" button → calls the action → renders the deep link + short instructions; a
  "Disconnect" when linked. All copy via next-intl `settings.telegram.*` (EN/UK). Wire into
  `settings/page.tsx` (which already has `requireUser()` → pass the link state).
- [ ] **Step 4:** `src/app/api/telegram/webhook/route.ts` (POST): verify the
  `X-Telegram-Bot-Api-Secret-Token` header equals `TELEGRAM_WEBHOOK_SECRET` (else 401). If
  `!telegramConfigured()` → 200 no-op. Parse the update; if `message.text` matches
  `/^\/start\s+(\S+)$/`, call `linkChatByCode(code, String(message.chat.id))`; reply via
  `sendTelegramMessage(chat.id, connected-or-invalid text)`. Always return 200 quickly (Telegram
  retries on non-200). Wrap everything; `logError` on failure; never leak the token.
- [ ] **Step 5:** Tests: `src/app/api/telegram/webhook/__tests__/route.test.ts` — wrong/missing
  secret → 401; valid `/start <code>` → calls `linkChatByCode` (mock the data + client) and
  returns 200; non-/start message → 200 no-op. `src/server/data/__tests__/telegram.test.ts` —
  `linkChatByCode` finds by code and sets chatId+nulls code (mock prisma); returns false when no
  match.
- [ ] **Step 6:** `pnpm test` + `pnpm lint` + `pnpm build` green. Commit:
  `feat: Telegram account-linking (settings action + webhook)`.

---

## Task 4: Daily reminder cron

**Files:** `src/app/api/cron/reminders/route.ts`, `src/server/data/telegram.ts` (add `listLinkedUsers`), test

- [ ] **Step 1:** `listLinkedUsers()` in `telegram.ts`: `prisma.user.findMany({ where: { telegramChatId: { not: null } }, select: { id:true, telegramChatId:true, locale:true } })`.
- [ ] **Step 2:** `src/app/api/cron/reminders/route.ts` (GET): verify
  `request.headers.get("authorization") === \`Bearer ${process.env.CRON_SECRET}\`` (else 401).
  If `!telegramConfigured()` → 200 `{skipped:"no token"}`. For each linked user:
  `getTodayFeed(user.id, new Date())` → if items, `formatReminderMessage(items, user.locale)` →
  `sendTelegramMessage(user.telegramChatId, msg)`. Catch/log per user (one failure doesn't abort
  others). Return `{ sent, skipped, failed }` counts. Never throw to the caller.
- [ ] **Step 3:** Test `route.test.ts`: missing/incorrect bearer → 401; correct secret with no
  token configured → 200 skipped; correct secret + a linked user with feed items → calls
  `sendTelegramMessage` (mock `getTodayFeed`, `listLinkedUsers`, the client). 
- [ ] **Step 4:** `pnpm test` + `pnpm lint` + `pnpm build` green. Commit:
  `feat: daily Telegram reminder cron endpoint`.

---

## Task 5: Vercel deploy readiness

**Files:** `package.json`, `vercel.json`, `.env.example`, `README.md`

- [ ] **Step 1: Prisma generate on build (critical for Vercel).** Add `"postinstall": "prisma generate"`
  to `package.json` scripts (so the client is generated on Vercel's fresh install). Verify
  `pnpm install` still works locally and `prisma generate` runs.
- [ ] **Step 2:** `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
```
  (Daily 08:00 UTC. Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` env is
  set — the cron route checks it.)
- [ ] **Step 3:** Ensure `.env.example` lists every required prod var with comments:
  `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`,
  `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`.
- [ ] **Step 4:** `pnpm build` green (with postinstall). Commit:
  `chore: Vercel deploy readiness (prisma generate on build + daily cron)`.

---

## Task 6: i18n + phase gate

- [ ] **Step 1:** Add `settings.telegram.*` (`title`, `connect`, `connected`, `disconnect`,
  `instructions`, `notConfigured`, `openBot`) and `reminder.*` (`header`, `contacts`,
  `birthdays`, `tasks`, `nothing`) namespaces to BOTH en.json + uk.json (natural Ukrainian,
  parity). No hardcoded strings.
- [ ] **Step 2: Full gate:** `pnpm lint && pnpm test && pnpm build` green; parity test green.
- [ ] **Step 3: Push:** `git push origin main`.

---

## Phase 8 Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` pass; EN/UK parity holds.
- [ ] User schema has `telegramChatId`/`telegramLinkCode`; migration applied.
- [ ] Settings can generate a `t.me/<bot>?start=<code>` link (when configured) and show
  connected/disconnected state; webhook links a chat by code (secret-verified) and is no-op
  without a token.
- [ ] `/api/cron/reminders` is `CRON_SECRET`-protected, computes each linked user's Today feed,
  formats a localized message, and sends via the Bot API; per-user failures are logged, not
  fatal; the whole thing is a no-op (200) without a token.
- [ ] Reminder formatting + webhook auth + cron auth + link-by-code are unit-tested (mocked
  network/DB); nothing throws to the caller; the bot token is never logged or returned.
- [ ] `postinstall: prisma generate` + `vercel.json` cron + documented env make the app
  deploy-ready; `.env`/secrets never committed.
- [ ] All committed and pushed to `origin/main`.

## Carried-forward
- Setting the Telegram webhook (`setWebhook` with the secret) and obtaining a bot token from
  BotFather are post-deploy steps (documented in HANDOFF.md) — they need the public URL + the
  user's token.
- WhatsApp is a future alternative channel.
