import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribeAudio, MAX_AUDIO_BYTES } from "@/server/stt/groq";

function blob(bytes: number) {
  return new Blob([new Uint8Array(bytes)], { type: "audio/webm" });
}

describe("transcribeAudio", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    process.env.GROQ_API_KEY = "gsk_test_secret";
  });
  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
    delete process.env.GROQ_API_KEY;
  });

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
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "Maria has a son" }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    const r = await transcribeAudio(blob(100), "uk");
    expect(r).toEqual({ status: "ok", text: "Maria has a son" });
  });

  it("returns EMPTY when the transcript is blank", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ text: "  " }), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await transcribeAudio(blob(100), "en");
    expect(r).toEqual({ status: "error", message: "EMPTY" });
  });

  it("returns REQUEST_FAILED and never leaks the key on a non-2xx / throw", async () => {
    global.fetch = vi.fn(
      async () => new Response("nope", { status: 401 }),
    ) as unknown as typeof fetch;
    const r1 = await transcribeAudio(blob(100), "en");
    expect(r1).toEqual({ status: "error", message: "REQUEST_FAILED" });
    global.fetch = vi.fn(async () => {
      throw new Error("network gsk_test_secret");
    }) as unknown as typeof fetch;
    const r2 = await transcribeAudio(blob(100), "en");
    expect(r2).toEqual({ status: "error", message: "REQUEST_FAILED" });
    expect(JSON.stringify(r2)).not.toContain("gsk_");
  });
});
