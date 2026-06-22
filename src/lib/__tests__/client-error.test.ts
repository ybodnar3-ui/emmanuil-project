import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportClientError } from "../client-error";

describe("reportClientError", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs a JSON payload with the message and scope to the bridge", () => {
    reportClientError(new Error("kaboom"), "window");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/client-error");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.message).toContain("kaboom");
    expect(body.scope).toBe("window");
  });

  it("never throws when fetch rejects", () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));
    expect(() => reportClientError(new Error("x"), "boundary")).not.toThrow();
  });

  it("handles a non-Error value without throwing", () => {
    expect(() => reportClientError("just a string", "window")).not.toThrow();
  });
});
