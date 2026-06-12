# Emmanuil

Personal relationship CRM + AI assistant. Your "portfolio of people": store what you know
about everyone, get AI briefs before meetings, and proactive reminders to stay in touch.

## Stack
Next.js (App Router, TS) · Tailwind + shadcn/ui · Supabase · Prisma · Anthropic Claude ·
next-intl (EN default + UK) · Vercel.

## Develop
```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # vitest
pnpm lint
pnpm build
```

## Environment
Copy `.env.example` to `.env` and fill it in. Required in production:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime Postgres (Supabase transaction pooler, :6543). |
| `DIRECT_URL` | Migrations (session/direct connection, :5432). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client/auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase admin key. |
| `ANTHROPIC_API_KEY` | Claude (assistant + suggestions). |
| `TELEGRAM_BOT_TOKEN` | Bot API token (@BotFather). Telegram is a no-op when unset. |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username for `t.me/<bot>?start=<code>` links. |
| `TELEGRAM_WEBHOOK_SECRET` | Verifies the `X-Telegram-Bot-Api-Secret-Token` webhook header. |
| `CRON_SECRET` | Verifies the `Authorization: Bearer` header on the reminder cron. |

## Deploy (Vercel)
- `postinstall` runs `prisma generate`, so the client is built on Vercel's fresh install.
- Apply migrations against the live DB with `pnpm db:deploy` (uses `DIRECT_URL`).
- `vercel.json` schedules a daily cron at 08:00 UTC hitting `/api/cron/reminders`; Vercel
  sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set, which the route checks.
- **Telegram (post-deploy, optional):** create a bot via @BotFather, set `TELEGRAM_BOT_TOKEN`
  + `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` + a random `TELEGRAM_WEBHOOK_SECRET`, then register the
  webhook with that secret:
  ```bash
  curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -d "url=https://<your-app>/api/telegram/webhook" \
    -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
  ```
  All Telegram code is token-gated: without a token the webhook/cron are clean 200 no-ops.

## i18n
Fully localized via next-intl — every user-facing string goes through translation keys,
with EN (default) and UK at full key parity (enforced by `src/i18n/__tests__/messages-parity.test.ts`).
Locale is cookie-based with an in-app switcher.

## PWA
The app is PWA-ready: an installable web manifest (`/manifest.webmanifest`), maskable + Apple
touch icons, `display: standalone`, theme-color, and safe-area insets for notched phones.
A service worker / offline caching / web-push are the next step (deferred post-MVP); the
manifest and layout are structured so they can be added without rework.

See `docs/superpowers/specs` for the design and `docs/superpowers/plans` for the roadmap.
