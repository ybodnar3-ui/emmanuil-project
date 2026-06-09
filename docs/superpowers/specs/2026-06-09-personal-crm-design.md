# Personal Relationship CRM + AI Assistant — Design Spec

**Date:** 2026-06-09
**Working name:** Emmanuil
**Status:** Approved (scope + stack + data model + screens)

## 1. Problem & Vision

A personal relationship manager ("portfolio of people") with an AI assistant at its
core. Aimed at high-value networkers (e.g. CEOs) who maintain many relationships and
want to nurture them deliberately.

The user stores everything they know about each person (family, kids, work, projects,
"things to ask about"). The product then:

- Answers "What do I know about this person?" with a concise AI brief before a meeting.
- Lets the user add/update facts in natural language (text or voice).
- Proactively reminds the user when it is time to reach out to someone (cadence),
  surfaces birthdays, and tracks one-off tasks ("research his project tomorrow",
  "message her in 3 days"), each with an AI-suggested talking point.

## 2. MVP Scope (YAGNI — core only)

1. **Auth** — multi-user, registration via email magic-link or Google. Each user's data
   is private.
2. **People (cards)** — name, photo, how-we-met, tags, location, birthday, relationship
   tier, plus structured facts (family/kids, work, projects, "ask about").
3. **Interaction timeline** per person — "talked on X, learned Y".
4. **AI brief** — "What do I know about [person]?" → concise brief: who they are,
   recent context, what to ask about, suggested talking points.
5. **Conversational AI (text + voice)** — "add that her son studies in London" updates
   facts; "what do I know about Maria?" returns a brief. Voice via browser Web Speech API.
6. **Cadence + tasks** — contact frequency (every 2 weeks / month / 3 months / year /
   custom), birthdays, one-off tasks with due dates.
7. **"Today" feed** — who to contact, upcoming birthdays, due tasks; each item carries an
   AI-suggested talking point and Done / Snooze actions.

### Explicitly out of MVP (later)
- Telegram/WhatsApp notification bot (fast-follow channel).
- Web push notifications (after full PWA conversion).
- Phone contact import, calendar sync, multi-device offline sync.

## 3. Tech Stack

- **Next.js (App Router, TypeScript)** — single codebase, mobile-first, PWA-ready.
- **Tailwind CSS + shadcn/ui** — fast, clean, premium UI.
- **Supabase** — Postgres + Auth + storage (photos) in one; fastest path to multi-user MVP.
- **Prisma** — typed DB access.
- **Anthropic Claude API** — briefs + conversational assistant. MVP uses
  `claude-sonnet`; upgradeable to Opus. (See latest model IDs at build time.)
- **Web Speech API** — browser-native voice input (no transcription backend in MVP).
- **next-intl** — i18n from day one. **English is the default**; Ukrainian is the second
  locale. All UI strings go through translation keys (no hardcoded copy).
- **Vercel** — hosting + Cron (daily recompute of "who to contact today").

*Alternative considered:* Neon + Auth.js instead of Supabase — more control, more manual
auth/storage work. Rejected for MVP in favor of Supabase's speed.

## 4. Data Model

- **User** — `id`, `email`, `name`, `locale`, `createdAt`. (Supabase Auth managed.)
- **Person** — `id`, `userId`, `fullName`, `photoUrl?`, `howWeMet?`, `location?`,
  `birthday?`, `tags[]`, `relationshipTier?` (VIP / friend / acquaintance), `createdAt`,
  `updatedAt`.
- **Fact** — `id`, `personId`, `category` (family / work / projects / interests /
  ask-about), `content`, `createdAt`.
- **Interaction** — `id`, `personId`, `date`, `channel?` (call / meeting / message),
  `summary`, `createdAt`.
- **Cadence** — `id`, `personId`, `intervalDays` (14 / 30 / 90 / 365 / custom),
  `lastContactedAt?`, `nextDueAt`.
- **Task** — `id`, `userId`, `personId?`, `title`, `dueAt`, `status` (todo / done),
  `note?`.
- **ChatMessage** (optional) — `id`, `userId`, `personId?`, `role`, `content`,
  `createdAt`.

A daily Cron computes the "Today" feed from `Cadence.nextDueAt`, `Person.birthday`, and
`Task.dueAt`.

## 5. Screens (mobile-first)

1. **Sign in** — magic-link / Google.
2. **Today** (home) — who to contact, birthdays, due tasks; each item with an AI talking
   point + Done / Snooze.
3. **People** — searchable list, filter by tag / tier.
4. **Person card** — facts by category, interaction timeline, cadence, "What do I know?"
   (AI brief) button, "Log interaction" button.
5. **Assistant** — chat (text + voice): ask about a person or add facts in natural
   language; assistant resolves who is meant and proposes card updates for confirmation.
6. **Settings** — profile, locale (EN/UK), notification channels (in-app for now), sign out.

## 6. AI Logic

- **Brief:** facts + recent interactions + cadence for a person → Claude returns a short
  structured brief (who, context, what to ask).
- **Fact capture:** text/voice → Claude extracts entities (person, category, fact) →
  proposes card updates; user confirms before persisting.

## 7. Build Order (phases)

1. Project scaffold: Next.js + Tailwind + shadcn/ui + next-intl + Prisma + Supabase
   connection; base layout and navigation.
2. Auth + multi-user data isolation (RLS).
3. People CRUD + Person card (facts, interactions, cadence).
4. AI brief.
5. Conversational AI (text), then voice input.
6. Cadence engine + Tasks + "Today" feed + daily Cron.
7. i18n pass (EN default, UK added) + PWA-readiness polish.

## 8. Non-functional

- **Privacy/security:** private contact data of high-value users → strict per-user data
  isolation (Supabase Row Level Security), no cross-user access.
- **PWA-ready:** mobile-first layout, structured so a PWA wrapper (manifest, service
  worker, web push) can be added without rework.
- **i18n:** all copy via translation keys from day one.
