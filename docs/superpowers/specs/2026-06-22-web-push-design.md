# Web Push Notifications (Phase C) — Design Spec

**Date:** 2026-06-22 · **Status:** Approved (design). Replaces the Telegram reminder channel
(Phase 8) with native **Web Push** so the daily proactive personalized reminders + key-date
greetings land on the user's phone as real notifications — the user's preferred channel.

## Why
The client wanted reminders on the phone without a separate app. Telegram (Phase 8) was the
interim delivery channel; the user has decided **web push is the only channel** going forward.
The original "capture a person by voice via Telegram" idea is already fully covered by the
in-app assistant voice capture (Groq Whisper → interpret → confirm), so Telegram has no remaining
purpose. **The entire Telegram subsystem is removed** in this phase.

## Decisions (from brainstorming)
- **Web push only.** No Telegram. The current Telegram code (account-linking webhook + outbound
  reminder delivery) exists solely to serve Telegram reminders, so it is deleted wholesale, not
  left dormant.
- **Self-hosted standard stack:** the `web-push` npm library + a minimal hand-written service
  worker. No third-party push vendor (cost, data-residency, extra keys). No PWA/offline framework
  (Serwist/next-pwa) — we need push only, not caching (YAGNI).
- **Reuse the existing daily cron + per-user Today feed.** Same 08:00 UTC schedule
  (`vercel.json`), same `getTodayFeed(userId, now, locale)`; only the *delivery* changes from
  Telegram HTML messages to push payloads.
- **Token-gated, no-throw/no-leak**, exactly like every other integration: with no VAPID keys the
  push layer is a clean no-op; failures are logged server-side and never leak keys or abort the
  cron for other users.
- **Multiple devices per user** (a user may install the PWA on phone + laptop) → a user has many
  `PushSubscription` rows. Dead subscriptions (push service returns 404/410 Gone) are pruned.
- **Daily digest only** (mirrors today's behavior). Real-time "push the moment something happens"
  is out of scope.

## iOS constraint (informational, not a choice)
On iPhone, Web Push works **only for a PWA added to the Home Screen** (Safari, iOS 16.4+). The
user must "Share → Add to Home Screen", open it from the icon (standalone), then grant
notification permission. Desktop/Android can subscribe directly from the browser. The Settings UI
surfaces this guidance when it detects iOS Safari not running standalone.

## Architecture & components

### Removal — Telegram subsystem (delete)
- `src/server/telegram/` (`client.ts`, `format.ts`, `__tests__/format.test.ts`)
- `src/app/api/telegram/` (webhook route + test)
- `src/server/data/telegram.ts` + `src/server/data/__tests__/telegram.test.ts`
- `src/app/(app)/settings/_components/connect-telegram.tsx`
- Telegram code in `src/app/(app)/settings/actions.ts` (link/unlink actions) and
  `settings/page.tsx` (Connect-Telegram render)
- Schema: drop `User.telegramChatId` + `User.telegramLinkCode` (additive-reverse DROP migration;
  the user's old linked chat id is intentionally discarded).
- i18n: remove `settings.telegram.*` keys (en + uk).
- `.env.example`: remove `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`. (Local `.env` + Vercel prod env cleaned by the user; the
  webhook should also be deregistered with Telegram — a user/ops action, noted in handoff.)
- `vercel.json` cron entry stays (now drives push).

### Schema (`prisma/schema.prisma`) — additive
```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  @@index([userId])
}
```
RLS `ENABLE`d on the new table (deny-by-default convention; app-layer scoping is the real guard).
Migration also DROPs the two Telegram columns.

### VAPID keys (env)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (exposed to the client as `applicationServerKey`)
- `VAPID_PRIVATE_KEY` (server only)
- `VAPID_SUBJECT` (e.g. `mailto:ybodnar3@gmail.com`, required by the spec)
Generated once via `web-push generate-vapid-keys`; stored in `.env` + backup + Vercel prod.
`.env.example` gets placeholder entries.

### Service worker (`public/sw.js`, served at `/sw.js`, scope `/`)
- `push` event → parse JSON payload → `self.registration.showNotification(title, { body, icon,
  badge, data: { url } })`.
- `notificationclick` → close the notification, focus an existing client at `data.url` or open a
  new window. No fetch/caching handlers (push-only).

### Data layer (`src/server/data/push.ts`) — ownership-scoped
- `saveSubscription(userId, { endpoint, keys: { p256dh, auth } })` — upsert by `endpoint`
  (same device re-subscribing updates keys + reassigns to this user).
- `deleteSubscription(userId, endpoint)` — delete only if the row's `userId` matches (cross-user
  safe), like `deleteKeyDate`.
- `listSubscriptions(userId)` — this user's subscriptions.
- `deleteSubscriptionByEndpoint(endpoint)` — internal prune used by the cron when the push service
  reports the endpoint is gone (no user scoping needed; the endpoint is unique).

### Delivery (`src/server/push/send.ts`)
- `pushConfigured(): boolean` — true iff all three VAPID env vars are set.
- `sendPush(subscription, payload): Promise<"ok" | "gone" | "error">` — calls
  `webpush.sendNotification` (sets VAPID details once at module load). Maps HTTP 404/410 →
  `"gone"` (caller prunes), other failures → `"error"` (logged, not thrown).
- No-throw/no-leak; never logs the VAPID private key or subscription secrets.

### Payload formatter (`src/server/push/format.ts`)
- `formatPushPayload(feed: FeedItem[], labels): { title, body, url } | null` — returns `null` for
  an empty feed (caller skips). Deterministic + localized. Groups the feed the way the old
  Telegram formatter did (contacts / dates / follow-ups) into a concise multi-line `body`; `url`
  is `/` (open the Today feed). This is the moved-and-adapted logic from the deleted
  `telegram/format.ts`.

### Cron (`src/app/api/cron/reminders/route.ts` — rewrite delivery)
- Keep the `CRON_SECRET` bearer guard and the per-user loop. Replace the Telegram branch:
  `if (!pushConfigured()) return Response.json({ skipped: "no vapid" })`. For each user: build the
  payload from `getTodayFeed`; if `null`, skip; else `sendPush` to every `listSubscriptions(user.id)`
  entry; prune any that return `"gone"`. Tally `{ sent, skipped, failed, pruned }`. One user's
  failure is logged and never aborts the rest. Runs on the Node.js runtime (`web-push` needs Node
  crypto) — set `export const runtime = "nodejs"` if not already the default.

### Client subscribe flow + Settings UI
- New `src/app/(app)/settings/_components/push-notifications.tsx` (`"use client"`) replacing the
  Telegram section: shows the per-device state (subscribed / not / unsupported) with
  Enable / Disable buttons.
  - **Enable:** register `/sw.js` → `Notification.requestPermission()` → `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY) })` → POST the subscription JSON to a server action `subscribePushAction`.
  - **Disable:** `subscription.unsubscribe()` + `unsubscribePushAction(endpoint)`.
  - **iOS hint:** if iOS Safari and not `display-mode: standalone`, show the "Add to Home Screen
    first" guidance instead of the Enable button.
  - **Unsupported:** if no `serviceWorker`/`PushManager`, show a graceful "not supported on this
    browser" note.
- Small helper `src/lib/push-client.ts` (or co-located) for `urlBase64ToUint8Array` + the
  register/subscribe wrapper.
- Server actions (`settings/actions.ts`): `subscribePushAction` and `unsubscribePushAction` —
  `requireUser()`, validate the subscription shape with zod, call the data layer, guarded
  (typed error + `logError`), no raw 500.

## Data flow
Settings → Enable → SW registered → permission granted → `pushManager.subscribe` →
`subscribePushAction` stores the subscription. Daily cron (08:00 UTC) → per user → `getTodayFeed`
→ `formatPushPayload` → `sendPush` to each subscription → user's phone shows the notification →
tap → app opens at `/`. Gone endpoints pruned during the send.

## Error handling
- No VAPID keys → cron + actions no-op cleanly (token-gated).
- All data access ownership-scoped; cross-user delete rejected.
- `sendPush` never throws; 404/410 → prune, other errors → `logError` and count as `failed`.
- Client: permission denied / unsupported / non-standalone iOS all degrade to clear UI states,
  never a crash. Subscription secrets and the VAPID private key never reach logs or the client
  bundle (only the public key is `NEXT_PUBLIC_`).

## Testing
- `push.ts` data layer: save (upsert by endpoint), cross-user delete rejection, list scoping
  (mock prisma).
- `push/format.ts`: groups a populated feed into title/body; empty feed → `null`; localized.
- `push/send.ts`: `pushConfigured` gating; `sendPush` maps 410→"gone", success→"ok", other→"error"
  (mock `web-push`), no throw, no key leak.
- cron route: 401 without `CRON_SECRET`; `{ skipped: "no vapid" }` when unconfigured; with mocked
  feed + subscriptions → sends per subscription and prunes "gone" ones; per-user failure isolated.
- Delete the Telegram tests; update the cron route test for the push path.
- EN/UK parity for new `settings.push.*` copy; remove `settings.telegram.*`.

## Out of scope
- Real-time / event-triggered push (only the daily digest).
- Offline caching / full PWA app-shell (SW is push-only).
- A separate notification-preferences screen (per-type toggles) — future if wanted.
- Remote voice capture as a distinct channel — already covered by in-app assistant voice.

## Acceptance
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity; no Telegram code or strings remain
  (`grep -ri telegram src messages` clean); no secrets committed.
- A user can Enable notifications in Settings (desktop/Android directly; iPhone after Add-to-Home-
  Screen) and the daily reminder arrives as a native push with the personalized text + key-date
  greetings; tapping it opens the app.
- Subscriptions are per-user-scoped; dead ones are pruned; the push layer is a no-op without VAPID
  keys; pushed to `main`.
