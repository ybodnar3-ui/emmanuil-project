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
