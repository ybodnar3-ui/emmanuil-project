import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Confirm-route contract (mocked supabase server client):
 *  - `?code=...` present → exchangeCodeForSession(code), redirect to sanitized next
 *  - exchange error → redirect to /login?error=expired, verifyOtp not called
 *  - `code` takes precedence over `token_hash`/`type` (OAuth wins)
 */

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
  }),
}));
vi.mock("@/server/log", () => ({ logError: () => {} }));

import { GET } from "../route";

function req(query: string): Request {
  return new Request(`https://app.test/auth/confirm${query}`);
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  verifyOtp.mockReset();
});

describe("auth confirm route — OAuth code", () => {
  it("exchanges the code and redirects to a sanitized next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(req("?code=abc123&next=/people"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/people");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("redirects to login?error=expired when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const res = await GET(req("?code=expired"));
    expect(res.headers.get("location")).toBe(
      "https://app.test/login?error=expired",
    );
  });

  it("prefers the OAuth code over token_hash/type", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    await GET(req("?code=abc&token_hash=th&type=magiclink"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
