# Voice Capture — Design Spec (v1: in-app, shared pipeline)

**Date:** 2026-06-13 · **Status:** Approved (design). Audience: relationship-CRM for high-value
networkers. Bilingual EN + UK (Ukrainian transcription must work well).

## Problem & vision
Capturing what you learn about people should be effortless: **speak a note, and it lands on the
right person's card** ("Maria's son just started his second year in London" → a Family fact on
Maria, after you confirm). This is the product's signature capture experience. v1 delivers it
**in the app**; the same engine later powers Telegram/WhatsApp voice-in.

## Key decisions (made during brainstorming)
- **Architecture:** a **channel-agnostic capture pipeline**, not a one-off. Channels (in-app
  mic, future Telegram, future WhatsApp) are thin adapters over a shared core. This is the
  sellable shape.
- **STT provider:** **Groq Whisper** (`whisper-large-v3`) — Whisper quality (strong Ukrainian),
  a free tier + ~$0.0007/min beyond, simple REST. Requires `GROQ_API_KEY` (free to obtain).
  Claude has no audio modality, so a dedicated STT is required.
- **Primary channel for v1:** in-app voice (replaces the weak browser Web Speech recognizer in
  the Assistant with server-side Groq transcription).
- **Confirm-before-persist** stays: transcript → proposal → user confirms → save.

## The shared pipeline (4 stages)
1. **Audio in (channel adapter):** in-app records audio (MediaRecorder → webm/opus blob) and
   uploads it to the server. *(Future: Telegram/WhatsApp webhooks download the voice file and
   feed the same stage 2.)*
2. **Transcribe:** server calls Groq Whisper → transcript. Pass the user's locale as a language
   hint (`uk`/`en`).
3. **Interpret:** transcript → the **existing** `interpretMessage` (roster-aware: resolves the
   person, classifies intent, extracts proposed facts / interaction). No new AI code.
4. **Confirm & apply:** in-app shows the **existing** `ProposalCard` → user confirms → the
   **existing** `applyProposal` writes (ownership-checked). *(Future async channels: auto-apply
   with an "undo" reply, since there's no confirm UI — out of scope for v1.)*

## Components

**New:**
- `src/server/stt/groq.ts` — `transcribeAudio(file: Blob|File|Buffer, locale: string):
  Promise<{ status:"ok"; text:string } | { status:"error"; message:string }>`. Calls Groq's
  OpenAI-compatible transcription endpoint with `whisper-large-v3`. **No-throw, no-leak**
  (never throws to caller, never returns/logs the API key or raw provider error), **token-gated**
  (if `GROQ_API_KEY` unset → returns a stable error code; the feature degrades to text-only).
  Enforce a max audio size/duration guard (reject oversize early with a clean error).
- `src/app/(app)/assistant/actions.ts` → add `captureVoiceAction(formData)`: `requireUser()` →
  read the uploaded audio + locale → `transcribeAudio` → return `{ status:"ok", text }` (the
  client puts it in the input for review) or `{ status:"error", code }`. (Keeps the existing
  `assistantSendAction`/`applyProposalAction` untouched — the transcript flows through them.)

**Changed (in-app UI):**
- The Assistant mic (`use-speech-recognition.ts` / `mic-button.tsx` + `assistant-chat.tsx`):
  record audio via `MediaRecorder` instead of browser `SpeechRecognition`; on stop → call
  `captureVoiceAction` → **fill the chat input with the transcript (editable)** so the user can
  fix any STT error → they send it → the existing interpret → proposal → confirm flow runs.
  Keep text typing. Show a recording indicator + a transcribing/loading state. Graceful states:
  mic-permission denied, transcription failed, empty transcript → localized message + "you can
  type instead". Feature-detect `MediaRecorder`; degrade if unsupported.

**Config:**
- `.env` + `.env.example`: `GROQ_API_KEY` (server-only).

## Data flow & privacy
Audio (not persisted) → Groq → transcript → Claude interpret → proposal → confirm → DB. **Audio
is discarded after transcription** (no storage). The transcript is shown to the user and is
editable before extraction. `GROQ_API_KEY` is server-only; all data access stays per-user.

## Error handling
- `transcribeAudio` catches everything, returns stable codes (`NO_KEY`, `TOO_LARGE`,
  `REQUEST_FAILED`, `EMPTY`); never leaks the key or provider text.
- UI maps codes to localized messages; on any failure the user can still type the note.
- Token-gated: with no `GROQ_API_KEY`, the mic shows a "voice not available — type instead"
  state (or falls back to the existing browser recognizer if we keep it as fallback); the app is
  otherwise unaffected.

## Testing
- `transcribeAudio`: unit tests with a mocked Groq client — success returns text; missing key →
  `NO_KEY`; oversize → `TOO_LARGE`; provider throw → `REQUEST_FAILED` (assert the serialized
  result contains no key/`gsk_` prefix/raw error); empty transcript → `EMPTY`. No real network.
- `captureVoiceAction`: `requireUser()` first; returns transcript on ok, stable code on error
  (mock `transcribeAudio`). Downstream interpret/proposal/apply already covered by existing tests.
- EN/UK i18n parity maintained for any new copy.

## Out of scope (documented future)
- **Telegram voice-in** and **WhatsApp voice-in** (WhatsApp is the heaviest: Meta Business +
  WhatsApp Cloud API + number + per-conversation cost — a separate larger phase). The v1
  pipeline (`transcribeAudio` + existing `interpretMessage`/`applyProposal`) is built so these
  attach as thin webhook adapters (download file → transcribe → interpret → auto-apply + undo).
- Persisting audio or transcripts; per-user usage limits / billing metering for STT minutes.

## Acceptance (v1)
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity holds.
- In the Assistant, recording a voice note transcribes it (via Groq) into the editable input;
  sending it runs the existing capture → proposal → confirm → save flow; result lands on the
  right person.
- Transcription failures and missing key degrade gracefully to text-only; no key/secret leaks;
  audio is not persisted.
- All committed/pushed; `GROQ_API_KEY` documented in `.env.example` (real key provided by user
  to go live).
