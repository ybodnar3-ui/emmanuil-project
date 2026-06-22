import { beforeEach, describe, expect, it, vi } from "vitest";

const logError = vi.fn();
vi.mock("@/server/log", () => ({ logError: (...a: unknown[]) => logError(...a) }));

import { POST } from "../route";

function post(body: string): Request {
  return new Request("https://app.test/api/client-error", {
    method: "POST",
    body,
  });
}

beforeEach(() => logError.mockReset());

describe("POST /api/client-error", () => {
  it("logs a valid payload under scope 'client' and returns 204", async () => {
    const res = await POST(
      post(JSON.stringify({ message: "boom", scope: "window", url: "/x" })),
    );
    expect(res.status).toBe(204);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toBe("client");
    // meta carries the reported scope + url
    expect(logError.mock.calls[0][2]).toMatchObject({ scope: "window", url: "/x" });
  });

  it("returns 400 without logging on a missing message", async () => {
    const res = await POST(post(JSON.stringify({ url: "/x" })));
    expect(res.status).toBe(400);
    expect(logError).not.toHaveBeenCalled();
  });

  it("returns 400 without logging on invalid JSON", async () => {
    const res = await POST(post("not json"));
    expect(res.status).toBe(400);
    expect(logError).not.toHaveBeenCalled();
  });

  it("drops an oversized body (204, no log)", async () => {
    const huge = JSON.stringify({ message: "x".repeat(20000) });
    const res = await POST(post(huge));
    expect(res.status).toBe(204);
    expect(logError).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    await expect(POST(post("{}"))).resolves.toBeInstanceOf(Response);
  });
});
