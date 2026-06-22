import webpush from "web-push";
import { logError } from "@/server/log";

/**
 * Web Push sender. Token-gated: with any VAPID var unset, pushConfigured() is
 * false and callers skip entirely. No-throw/no-leak: sendPush maps a dead
 * endpoint (404/410) to "gone" so the caller prunes it, any other failure to
 * "error" (logged server-side, never thrown), success to "ok". The VAPID private
 * key is never logged.
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

let vapidSet = false;
function ensureVapid(): void {
  if (vapidSet) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidSet = true;
}

export async function sendPush(
  subscription: Subscription,
  payload: PushPayload,
): Promise<"ok" | "gone" | "error"> {
  ensureVapid();
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
