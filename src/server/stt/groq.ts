import { logError } from "@/server/log";

/**
 * Server-only Groq Whisper speech-to-text client.
 *
 * Conventions (mirror the existing AI no-throw/no-leak contract):
 *  - Token-gated: with no `GROQ_API_KEY` it returns `{status:"error", message:"NO_KEY"}`
 *    and never touches the network — voice capture degrades to text-only.
 *  - No-throw: every failure path returns a stable `TranscribeResult` error code.
 *  - No-leak: the API key and raw provider error are NEVER returned to the caller
 *    or put in a log. `logError` (server-only) gets at most `HTTP <status>` or the
 *    caught error — callers map `message` to a localized string in the UI.
 *  - Size-guarded: rejects oversize audio before spending a request.
 *
 * Uses `fetch` + `FormData` against the OpenAI-compatible Groq endpoint; no SDK.
 */

export const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // Groq Whisper limit is 25MB; stay under.
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

export type TranscribeResult =
  | { status: "ok"; text: string }
  | {
      status: "error";
      message: "NO_KEY" | "TOO_LARGE" | "REQUEST_FAILED" | "EMPTY";
    };

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
    if (!res.ok) {
      logError("stt.groq", new Error(`HTTP ${res.status}`));
      return { status: "error", message: "REQUEST_FAILED" };
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) return { status: "error", message: "EMPTY" };
    return { status: "ok", text };
  } catch (err) {
    logError("stt.groq", err);
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
