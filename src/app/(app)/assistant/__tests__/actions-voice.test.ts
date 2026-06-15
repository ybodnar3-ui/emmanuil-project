import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * captureVoiceAction contract: auth-gated voice → transcript. requireUser runs
 * before transcription; a non-Blob audio field short-circuits to NO_AUDIO without
 * calling Groq; transcribe errors pass their stable code straight through. All
 * collaborators (auth, locale, the STT client, and the data/cache deps the action
 * module imports) are mocked so no real network/audio/db is touched.
 */

const requireUser = vi.fn();
const transcribeAudio = vi.fn();
const getLocaleFromCookie = vi.fn();

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));
vi.mock("@/server/stt/groq", () => ({
  transcribeAudio: (...a: unknown[]) => transcribeAudio(...a),
}));
vi.mock("@/i18n/locale", () => ({
  getLocaleFromCookie: (...a: unknown[]) => getLocaleFromCookie(...a),
}));
// The action module imports these at the top; stub them so import is side-effect-free.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/data/people", () => ({ getPerson: vi.fn() }));
vi.mock("@/server/data/proposals", () => ({
  listRoster: vi.fn(),
  applyProposal: vi.fn(),
}));
vi.mock("@/server/ai/assistant", () => ({
  interpretMessage: vi.fn(),
  answerQuestion: vi.fn(),
}));

import { captureVoiceAction } from "../actions";

function audioForm(value: unknown): FormData {
  const fd = new FormData();
  if (value !== undefined) {
    // FormData only accepts Blob/string; cast lets us also feed a non-Blob string.
    fd.append("audio", value as Blob | string);
  }
  return fd;
}

beforeEach(() => {
  requireUser.mockReset();
  transcribeAudio.mockReset();
  getLocaleFromCookie.mockReset();
  requireUser.mockResolvedValue({ id: "u1" });
  getLocaleFromCookie.mockResolvedValue("uk");
});

describe("captureVoiceAction", () => {
  it("transcribes the blob with the cookie locale and returns the text", async () => {
    transcribeAudio.mockResolvedValue({ status: "ok", text: "Maria has a son" });
    const blob = new Blob([new Uint8Array(10)], { type: "audio/webm" });
    const r = await captureVoiceAction(audioForm(blob));
    expect(r).toEqual({ status: "ok", text: "Maria has a son" });
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    // FormData.get returns a Blob/File view of the appended value (not the same
    // reference under undici), so assert on shape: a Blob of the right size + locale.
    const [passedAudio, passedLocale] = transcribeAudio.mock.calls[0];
    expect(passedAudio).toBeInstanceOf(Blob);
    expect((passedAudio as Blob).size).toBe(10);
    expect(passedLocale).toBe("uk");
  });

  it("returns NO_AUDIO for a non-Blob audio field and never calls transcribe", async () => {
    const r = await captureVoiceAction(audioForm("not-a-blob"));
    expect(r).toEqual({ status: "error", code: "NO_AUDIO" });
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("returns NO_AUDIO when the audio field is missing", async () => {
    const r = await captureVoiceAction(audioForm(undefined));
    expect(r).toEqual({ status: "error", code: "NO_AUDIO" });
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("passes a transcribe error code straight through (NO_KEY)", async () => {
    transcribeAudio.mockResolvedValue({ status: "error", message: "NO_KEY" });
    const blob = new Blob([new Uint8Array(10)], { type: "audio/webm" });
    const r = await captureVoiceAction(audioForm(blob));
    expect(r).toEqual({ status: "error", code: "NO_KEY" });
  });

  it("passes a transcribe error code straight through (REQUEST_FAILED)", async () => {
    transcribeAudio.mockResolvedValue({
      status: "error",
      message: "REQUEST_FAILED",
    });
    const blob = new Blob([new Uint8Array(10)], { type: "audio/webm" });
    const r = await captureVoiceAction(audioForm(blob));
    expect(r).toEqual({ status: "error", code: "REQUEST_FAILED" });
  });

  it("calls requireUser before transcribing", async () => {
    const calls: string[] = [];
    requireUser.mockImplementation(async () => {
      calls.push("auth");
      return { id: "u1" };
    });
    transcribeAudio.mockImplementation(async () => {
      calls.push("transcribe");
      return { status: "ok", text: "hi" };
    });
    const blob = new Blob([new Uint8Array(10)], { type: "audio/webm" });
    await captureVoiceAction(audioForm(blob));
    expect(calls).toEqual(["auth", "transcribe"]);
  });

  it("does not transcribe (NO_AUDIO) but still gates on auth for a bad field", async () => {
    await captureVoiceAction(audioForm("nope"));
    expect(requireUser).toHaveBeenCalledTimes(1);
  });
});
