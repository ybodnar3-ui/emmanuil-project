# Emmanuil — Handoff Guide

Personal relationship CRM + AI assistant. Your "portfolio of people": store what you know
about everyone, get AI briefs before meetings, capture facts by voice/text, and get proactive
reminders to stay in touch.

This document is everything needed to run, test, deploy, and continue the project (e.g. in the
Cursor terminal). Deeper design/rationale lives in `docs/superpowers/` (spec, roadmap, and a
plan per phase).

---

## 1. Tech stack

- **Next.js 16** (App Router, TypeScript) — mobile-first, PWA-ready
- **Tailwind CSS + shadcn/ui** (Base UI under the hood)
- **Supabase** — Postgres + Auth (magic-link) + Storage (person photos)
- **Prisma 7** (`@prisma/adapter-pg`) — typed DB access; migrations in `prisma/migrations/`
- **Anthropic Claude** (`claude-sonnet-4-6`) — briefs, conversational assistant, talking points
- **next-intl** — bilingual **EN (default) + UK**, cookie-based; parity enforced by a test
- **Web Speech API** — voice input in the assistant
- **Telegram Bot API** — daily reminder notifications (Phase 8)
- **Vitest** — unit tests (147+), all server logic + data layer + AI parsing mocked

---

## 2. Architecture (where things live)

```
src/
  app/
    (app)/                      ← protected route group (requireUser gate in its layout)
      page.tsx                  ← Today feed (cadence-due + birthdays + tasks)
      people/                   ← list, [id] card, new, [id]/edit; actions.ts
      assistant/                ← conversational AI chat (text + voice); actions.ts
      settings/                 ← locale switch, sign out, Connect Telegram
    login/ , auth/confirm , auth/signout   ← public auth routes
    api/telegram/webhook        ← Telegram /start account-linking webhook
    api/cron/reminders          ← daily reminder sender (CRON_SECRET-protected)
    error.tsx, global-error.tsx, (app)/error.tsx, people/[id]/not-found.tsx
    manifest.ts                 ← PWA web manifest
  server/
    db.ts                       ← Prisma singleton (pg adapter)
    auth.ts                     ← getCurrentUser / requireUser (upserts User from Supabase)
    log.ts                      ← server-only structured logger (logError)
    supabase/                   ← SSR client + session-refresh used by src/proxy.ts
    data/                       ← per-user-scoped queries (people, facts, interactions,
                                   cadence, tasks, today, proposals, telegram)
    ai/                         ← client, brief, assistant (interpret/answer), suggest
    today/                      ← pure date helpers + feed assembly
    validation/                 ← zod schemas
    telegram/                   ← Bot API client + pure reminder formatter
  i18n/                         ← next-intl config + locale cookie + parity test
  proxy.ts                      ← Next 16 middleware (session refresh; renamed from middleware.ts)
messages/en.json, messages/uk.json   ← all UI copy (keep key parity)
prisma/schema.prisma            ← 7 models + Telegram link fields
docs/superpowers/               ← spec + roadmap + per-phase plans
```

**Key invariants (keep these):**
- **Per-user isolation:** every data-layer fn takes `userId` and scopes by it; nested entities
  go through `assertPersonOwned`. Never write an unscoped query.
- **AI no-throw / no-leak:** AI + network calls return typed result codes; they never throw to
  the client and never leak the API key or raw provider error. Log server-side via `logError`.
- **Confirm-before-persist:** the assistant proposes card updates; only an explicit Confirm
  (`applyProposalAction`) writes.
- **i18n:** all user-facing strings via next-intl keys, EN + UK, parity test must stay green.
- **Dates are UTC** throughout (display + math).

---

## 3. Local development

Prereqs: Node 20+, pnpm 9+.

```bash
pnpm install            # also runs `prisma generate` (postinstall)
cp .env.example .env     # then fill in the values (see §4)
pnpm dev                 # http://localhost:3000
pnpm test                # vitest (unit)
pnpm lint
pnpm build
```

Prisma:
```bash
pnpm db:migrate          # prisma migrate dev (uses DIRECT_URL)
pnpm db:studio           # inspect data
pnpm db:format
```

> Secrets live only in `.env` (git-ignored). A backup of the working secrets is kept outside
> the repo at `~/Documents/emmanuil-secrets/`. Never commit `.env`.

---

## 4. Environment variables

All required vars are documented in `.env.example`. Summary:

| Var | Where to get it | Notes |
|-----|-----------------|-------|
| `DATABASE_URL` | Supabase → Connect → Transaction pooler (port 6543) | append `?pgbouncer=true`; runtime |
| `DIRECT_URL` | Supabase → Connect → Session pooler (port 5432) | migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → publishable/anon | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → secret/service_role | **server-only** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | server-only |
| `TELEGRAM_BOT_TOKEN` | @BotFather | optional; unset = Telegram is a no-op |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | your bot's username (no @) | for the deep link |
| `TELEGRAM_WEBHOOK_SECRET` | random string you choose | set on `setWebhook`; webhook verifies it |
| `CRON_SECRET` | random string you choose | Vercel sends it as `Authorization: Bearer`; cron verifies |

Current project: Supabase ref `syuvmkohpofyqyxfrewy` (region Tokyo). DB/Supabase/Anthropic
values are already in the local `.env`.

---

## 5. Deploy to Vercel

1. Push is already on GitHub: `ybodnar3-ui/emmanuil-project` (branch `main`).
2. In Vercel: **New Project → import the repo**. Framework = Next.js (auto). Build is default
   (`prisma generate` runs via `postinstall`).
3. **Environment Variables:** add every var from `.env` (§4) to the Vercel project (Production
   + Preview). Use the same values as local for DB/Supabase/Anthropic; set `CRON_SECRET` to a
   fresh random string.
4. Deploy. Note the production URL, e.g. `https://emmanuil.vercel.app`.
5. **Supabase Auth → URL Configuration:** set **Site URL** to the Vercel URL and add
   `https://<your-domain>/auth/confirm` to **Redirect URLs** (and keep
   `http://localhost:3000/auth/confirm` for local).
6. The daily reminder cron (`vercel.json` → `/api/cron/reminders`, 08:00 UTC) is picked up
   automatically; it's protected by `CRON_SECRET`.

---

## 6. Enable Telegram notifications (after deploy)

1. **@BotFather** → `/newbot` → get the **bot token** and **username**. Set
   `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` in Vercel.
2. Choose a random `TELEGRAM_WEBHOOK_SECRET` (Vercel env), then register the webhook (one-time):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<your-domain>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. In the app: **Settings → Connect Telegram** → open the `t.me/<bot>?start=<code>` link → tap
   Start. The webhook links your chat. From then on the daily cron DMs your "Today" list.

Until a token is set, all Telegram code is a clean no-op (the app works normally without it).

---

## 7. What's done vs. what's next

**Done (MVP, Phases 1–8):** auth + multi-user + RLS; people CRUD + photos; facts / interactions
/ cadence; AI brief; conversational assistant (text + voice) with confirm-before-persist; Today
feed (cadence/birthdays/tasks) with Done/Snooze + AI talking points; full EN/UK i18n;
PWA-ready manifest/icons; error boundaries + structured logging; Telegram reminders;
Vercel-ready.

**Known limitations / next steps:**
- The Telegram webhook reply (the "Connected"/"invalid code" confirmation) is static English —
  the daily reminder content itself is localized per user.
- Service worker / offline / web-push not built (manifest is ready for it).
- Assistant chat history is ephemeral (not persisted) — `ChatMessage` model exists for later.
- Phone-contact import, per-user DB locale, and a premium UI polish pass are future work.
- Live in-browser smoke test of the full flow has been done once (login → people → brief →
  assistant → today feed all verified with real Claude calls); add automated E2E later.

**Working in Cursor:** everything is on `main`. Pick up from `docs/superpowers/` (each phase has
a plan). Follow the invariants in §2. Run `pnpm test && pnpm lint && pnpm build` before pushing.
