import webpush from "web-push";
import { logError } from "@/server/log";

/**
 * Web Push sender. Token-gated: with any VAPID var unset, pushConfigured() is
 * false and callers skip entirely. No-throw/no-leak: sendPush maps a dead
 * endpoint (404/410) to "gone" so the caller prunes it, any other failure to
 * "error" (logged server-side, never thrown), success to "ok". The VAPID private
 * key is never logged. VAPID details are applied on every send (a cheap
 * synchronous in-memory assignment) so key rotation and test isolation work.
 */

export type PushPayload = { title: string; body: string; url: string };
type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function setVapid(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function sendPush(
  subscription: Subscription,
  payload: PushPayload,
): Promise<"ok" | "gone" | "error"> {
  setVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
    );
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "gone";
    // Log only the endpoint + status — never the keys or the VAPID secret.
    logError("push.send", err, {
      endpoint: subscription.endpoint,
      status,
    });
    return "error";
  }
}
