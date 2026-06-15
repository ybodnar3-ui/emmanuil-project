# Voice Capture (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax. The STT client and the server action are **test-first** (mocked `fetch` / mocked
> `transcribeAudio` — no real network, no real audio). The recording UI uses build/render gates.
> **LLM/AI-adjacent code:** the existing AI no-throw/no-leak conventions apply (stable error
> codes; never leak the API key or raw provider error to the client; `logError` server-side).

**Goal:** Let a user record a voice note in the Assistant; it's transcribed server-side via Groq
Whisper into the (editable) chat input, then flows through the existing interpret → proposal →
confirm → save pipeline so the note lands on the right person's card.

**Architecture:** A channel-agnostic capture pipeline. New: a server STT module
(`transcribeAudio`, Groq Whisper, token-gated, no-throw/no-leak) + a `captureVoiceAction` that
transcribes an uploaded audio blob. Changed: the Assistant mic records audio (MediaRecorder)
and uploads it instead of using the weak browser `SpeechRecognition`; the transcript fills the
existing chat input for review, then reuses the existing `assistantSendAction`/`applyProposal`
flow unchanged.

**Tech Stack:** Next.js 16 server actions · Groq Whisper (`whisper-large-v3`, OpenAI-compatible
REST via `fetch`+`FormData`, no SDK) · MediaRecorder Web API · next-intl · Vitest.

---

## File structure (this feature)
- `src/server/stt/groq.ts` — `transcribeAudio(file, locale)` Groq Whisper client (token-gated, no-throw/no-leak, size guard).
- `src/server/stt/__tests__/groq.test.ts` — mocked-fetch unit tests.
- `src/app/(app)/assistant/actions.ts` — ADD `captureVoiceAction(formData)`.
- `src/app/(app)/assistant/__tests__/actions-voice.test.ts` — action tests (mock transcribe + requireUser).
- `src/app/(app)/assistant/_components/use-audio-recorder.ts` — client hook: MediaRecorder record/stop → Blob (feature-detect + permission).
- `src/app/(app)/assistant/_components/mic-button.tsx` — MODIFY: drive `useAudioRecorder`, emit the recorded Blob (replaces the Web Speech wiring).
- `src/app/(app)/assistant/_components/assistant-chat.tsx` — MODIFY: on recorded Blob → `captureVoiceAction` → fill the input with the transcript (editable) + transcribing/error states.
- `src/app/(app)/assistant/_components/use-speech-recognition.ts` — REMOVE (superseded) if nothing else imports it.
- `.env` / `.env.example` — `GROQ_API_KEY`.
- `messages/en.json` + `messages/uk.json` — `assistant.voice.*` keys.

---

## Task 1: Groq STT client (test-first)

**Files:** `src/server/stt/groq.ts`, `src/server/stt/__tests__/groq.test.ts`

- [ ] **Step 1: Write failing tests** `src/server/stt/__tests__/groq.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribeAudio, MAX_AUDIO_BYTES } from "@/server/stt/groq";

function blob(bytes: number) {
  return new Blob([new Uint8Array(bytes)], { type: "audio/webm" });
}

describe("transcribeAudio", () => {
  const realFetch = global.fetch;
  beforeEach(() => { process.env.GROQ_API_KEY = "gsk_test_secret"; });
  afterEach(() => { global.fetch = realFetch; vi.restoreAllMocks(); delete process.env.GROQ_API_KEY; });

  it("returns NO_KEY when the key is unset", async () => {
    delete process.env.GROQ_API_KEY;
    const r = await transcribeAudio(blob(100), "en");
    expect(r).toEqual({ status: "error", message: "NO_KEY" });
  });

  it("rejects oversize audio with TOO_LARGE before calling the API", async () => {
    const spy = vi.fn();
    global.fetch = spy as unknown as typeof fetch;
    const r = await transcribeAudio(blob(MAX_AUDIO_BYTES + 1), "en");
    expect(r).toEqual({ status: "error", message: "TOO_LARGE" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns the transcript text on success", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ text: "Maria has a son" }), { status: 200 })) as unknown as typeof fetch;
    const r = await transcribeAudio(blob(100), "uk");
    expect(r).toEqual({ status: "ok", text: "Maria has a son" });
  });

  it("returns EMPTY when the transcript is blank", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ text: "  " }), { status: 200 })) as unknown as typeof fetch;
    const r = await transcribeAudio(blob(100), "en");
    expect(r).toEqual({ status: "error", message: "EMPTY" });
  });

  it("returns REQUEST_FAILED and never leaks the key on a non-2xx / throw", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    const r1 = await transcribeAudio(blob(100), "en");
    expect(r1).toEqual({ status: "error", message: "REQUEST_FAILED" });
    global.fetch = vi.fn(async () => { throw new Error("network gsk_test_secret"); }) as unknown as typeof fetch;
    const r2 = await transcribeAudio(blob(100), "en");
    expect(r2).toEqual({ status: "error", message: "REQUEST_FAILED" });
    expect(JSON.stringify(r2)).not.toContain("gsk_");
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (module not found): `pnpm test src/server/stt` → fails.

- [ ] **Step 3: Implement** `src/server/stt/groq.ts`:
```ts
import { logError } from "@/server/log";

export const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // Groq Whisper limit is 25MB; stay under
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

export type TranscribeResult =
  | { status: "ok"; text: string }
  | { status: "error"; message: "NO_KEY" | "TOO_LARGE" | "REQUEST_FAILED" | "EMPTY" };

export async function transcribeAudio(
  file: Blob,
  locale: string,
): Promise<TranscribeResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { status: "error", message: "NO_KEY" };
  if (file.size > MAX_AUDIO_BYTES) return { status: "error", message: "TOO_LARGE" };
  try {
    const form = new FormData();
    form.append("file", file, "audio.webm");
    form.append("model", MODEL);
    form.append("response_format", "json");
    const lang = locale === "uk" ? "uk" : "en";
    form.append("language", lang);
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) { logError("stt.groq", new Error(`HTTP ${res.status}`)); return { status: "error", message: "REQUEST_FAILED" }; }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) return { status: "error", message: "EMPTY" };
    return { status: "ok", text };
  } catch (err) {
    logError("stt.groq", err);
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
```
  (Never put the key in a log/return; `logError` only gets `HTTP <status>` or the caught error —
  and the test asserts no `gsk_` leaks.)

- [ ] **Step 4: Run, expect PASS:** `pnpm test src/server/stt` → all pass.
- [ ] **Step 5: Commit:** `feat: Groq Whisper STT client (token-gated, no-throw/no-leak)`.

---

## Task 2: captureVoiceAction (test-first)

**Files:** `src/app/(app)/assistant/actions.ts`, `src/app/(app)/assistant/__tests__/actions-voice.test.ts`

- [ ] **Step 1:** Add to `actions.ts` (read existing imports — it already imports `requireUser` and `getLocaleFromCookie`; reuse them):
```ts
import { transcribeAudio } from "@/server/stt/groq";
// ...
export async function captureVoiceAction(
  formData: FormData,
): Promise<{ status: "ok"; text: string } | { status: "error"; code: string }> {
  const user = await requireUser(); // ensures only authed users transcribe
  void user;
  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) return { status: "error", code: "NO_AUDIO" };
  const locale = await getLocaleFromCookie();
  const r = await transcribeAudio(audio, locale);
  return r.status === "ok"
    ? { status: "ok", text: r.text }
    : { status: "error", code: r.message };
}
```
  (Keep `assistantSendAction`/`applyProposalAction` unchanged — the transcript reuses them.)

- [ ] **Step 2: Test** `actions-voice.test.ts` — `vi.mock("@/server/stt/groq")`, `vi.mock("@/server/auth")` (requireUser → a user), `vi.mock("@/i18n/locale")` (getLocaleFromCookie → "uk"):
  - audio present + transcribe ok → `{status:"ok", text}` and `transcribeAudio` called with the blob + "uk";
  - non-Blob `audio` → `{status:"error", code:"NO_AUDIO"}` (transcribe NOT called);
  - transcribe error (`NO_KEY`/`REQUEST_FAILED`) → `{status:"error", code:<same>}`;
  - `requireUser` is called before transcription.
  (Follow the existing assistant action test style in `src/app/(app)/assistant/__tests__/`.)

- [ ] **Step 3:** `pnpm test src/app/(app)/assistant` → PASS. `pnpm build` + `pnpm lint` clean.
- [ ] **Step 4: Commit:** `feat: captureVoiceAction (auth-gated voice→transcript)`.

---

## Task 3: In-app recording (MediaRecorder) wired to the Assistant

**Files:** `src/app/(app)/assistant/_components/use-audio-recorder.ts` (create),
`mic-button.tsx` (modify), `assistant-chat.tsx` (modify), remove `use-speech-recognition.ts` if unused.

- [ ] **Step 1:** `use-audio-recorder.ts` (client hook): feature-detect `navigator.mediaDevices?.getUserMedia` and `window.MediaRecorder`; expose `{ supported, recording, error, start(), stop() }` where `stop()` resolves a `Blob` (audio/webm). On `start()`, request the mic (`getUserMedia({audio:true})`); on permission denial set a `permissionDenied`/`error` state and `recording=false` (don't throw). Collect chunks via `dataavailable`; on `stop()` build the Blob from chunks, stop all tracks (release the mic), and resolve. Clean up on unmount. Type the MediaRecorder bits locally as needed; avoid stray `any` where reasonable. Use `useSyncExternalStore` or simple state consistent with the existing hook pattern.

- [ ] **Step 2:** `mic-button.tsx`: replace the Web Speech wiring with `useAudioRecorder`. Render a mic toggle: idle → "start recording" (`assistant.voice.start`); recording → a clear recording indicator + "stop" (`assistant.voice.stop`, `aria-pressed`); if `!supported` → hidden or disabled with `assistant.voice.notAvailable` tooltip; if `permissionDenied` → surface `assistant.voice.denied` (role="status"). On stop, pass the resolved `Blob` up via an `onRecorded(blob: Blob)` prop. Respect reduced-motion.

- [ ] **Step 3:** `assistant-chat.tsx`: pass `onRecorded` to `<MicButton>`. On a recorded blob: set a local `transcribing` state (show `assistant.voice.transcribing`, disable input/mic), build `FormData` with `audio`, call `captureVoiceAction(fd)`:
  - ok → put `text` into the chat input value (editable — user reviews/edits, then sends via the existing send path);
  - error → map `code` to a localized message (`assistant.voice.errors.<code|generic>`), shown inline (`role="alert"`); keep the typed text path usable.
  Clear `transcribing` in a `finally`. Keep the existing text-send + proposal/confirm flow untouched.

- [ ] **Step 4:** If `use-speech-recognition.ts` is no longer imported anywhere, delete it (and remove the now-unused `voice.denied`/`voice.unsupported` keys ONLY if they're truly unused — otherwise keep). Verify with a grep.

- [ ] **Step 5:** `pnpm lint` + `pnpm build` green. Manual gate (optional, needs a session + a real mic / a stubbed blob): recording a note fills the input with a transcript; sending it produces a proposal; a denied mic / failure shows a localized message and you can still type. Commit: `feat: in-app audio recording → Groq transcription in the Assistant`.

---

## Task 4: env + i18n + phase gate

**Files:** `.env.example`, `.env` (local placeholder), `messages/en.json`, `messages/uk.json`

- [ ] **Step 1:** Add `GROQ_API_KEY=""` to `.env.example` (with a one-line comment: Groq Whisper
  STT; free tier; unset = voice capture is a no-op/text-only) and as an empty placeholder to the
  local `.env` (so nothing breaks). NEVER commit `.env`.
- [ ] **Step 2:** Add `assistant.voice.*` keys to BOTH `messages/en.json` and `messages/uk.json`
  (natural Ukrainian, keep parity): `start`, `stop`, `recording`, `transcribing`,
  `notAvailable`, `denied`, `errors.NO_KEY`, `errors.TOO_LARGE`, `errors.REQUEST_FAILED`,
  `errors.EMPTY`, `errors.NO_AUDIO`, `errors.generic`. (Reuse/rename existing `assistant.voice.*`
  keys where present to avoid duplicates; keep EN/UK parity test green.)
- [ ] **Step 3: Full gate:** `pnpm lint && pnpm test && pnpm build` all green; parity test green.
- [ ] **Step 4: Push:** `git push origin main` (auto-deploys on Vercel; voice stays a no-op until
  `GROQ_API_KEY` is set in the Vercel env).

---

## Done criteria
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity holds.
- `transcribeAudio` (Groq, token-gated, no-throw/no-leak, size-guarded) + `captureVoiceAction`
  (auth-gated) are unit-tested with mocks (no real network/audio); no key/secret leaks.
- In the Assistant, recording a voice note transcribes it into the editable input via Groq;
  sending runs the existing interpret → proposal → confirm → save flow.
- Missing key / transcription failure / denied mic degrade gracefully to text-only.
- `GROQ_API_KEY` documented in `.env.example`; secrets never committed; pushed to `origin/main`.

## Self-review notes
- Spec coverage: STT client (T1), captureVoiceAction (T2), in-app recording UI (T3), env+i18n
  (T4), no-throw/no-leak + token-gated + size guard (T1), audio not persisted (never stored —
  blob is transcribed then dropped), graceful degradation (T3). Channels Telegram/WhatsApp are
  explicitly out of v1 scope (pipeline reused later). ✓
- Types consistent: `TranscribeResult` (`status`+`message` code) in T1; `captureVoiceAction`
  returns `status`+`text`/`code` in T2; UI maps `code` in T3. ✓
- No placeholders; every code step has real code. ✓
