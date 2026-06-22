import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    sendNotification: (...a: unknown[]) => sendNotification(...a),
    setVapidDetails: (...a: unknown[]) => setVapidDetails(...a),
  },
}));

const logError = vi.fn();
vi.mock("@/server/log", () => ({ logError: (...a: unknown[]) => logError(...a) }));

import { pushConfigured, sendPush } from "../send";

const sub = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "p", auth: "a" },
};
const payload = { title: "Hi", body: "Two people to reach out to", url: "/" };

beforeEach(() => {
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  logError.mockReset();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:t@e.com";
});

describe("pushConfigured", () => {
  it("true only when all three VAPID vars are set", () => {
    expect(pushConfigured()).toBe(true);
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushConfigured()).toBe(false);
  });
});

describe("sendPush", () => {
  it("returns 'ok' on success", async () => {
    sendNotification.mockResolvedValue({});
    const r = await sendPush(sub, payload);
    expect(r).toBe("ok");
    // payload is JSON-stringified
    expect(sendNotification.mock.calls[0][1]).toBe(JSON.stringify(payload));
  });

  it("returns 'gone' on 410 so the caller prunes", async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 });
    expect(await sendPush(sub, payload)).toBe("gone");
  });

  it("returns 'gone' on 404", async () => {
    sendNotification.mockRejectedValue({ statusCode: 404 });
    expect(await sendPush(sub, payload)).toBe("gone");
  });

  it("returns 'error' (logged, not thrown) on other failures", async () => {
    sendNotification.mockRejectedValue({ statusCode: 500 });
    const r = await sendPush(sub, payload);
    expect(r).toBe("error");
    expect(logError).toHaveBeenCalled();
  });

  it("does not leak the VAPID private key in the log meta", async () => {
    sendNotification.mockRejectedValue(new Error("boom"));
    await sendPush(sub, payload);
    const serialized = JSON.stringify(logError.mock.calls);
    expect(serialized).not.toContain("priv");
  });
});
