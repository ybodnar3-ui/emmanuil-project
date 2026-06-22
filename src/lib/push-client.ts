/**
 * Browser-only helpers for the Web Push subscribe flow. No server imports.
 * `urlBase64ToUint8Array` converts the base64url VAPID public key into the
 * Uint8Array the Push API expects as applicationServerKey.
 */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS only allows Web Push for a PWA launched from the Home Screen (standalone). */
export function isIosNotStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes navigator.standalone for home-screen apps
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  // Back the array with a concrete ArrayBuffer so it satisfies BufferSource
  // (applicationServerKey) under the strict lib.dom typings.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Register the SW, request permission, and create a push subscription.
 *  Returns the subscription JSON (to POST to the server) or throws/returns null. */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON | null> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return sub.toJSON();
}

/** Unsubscribe this device. Returns the endpoint that was removed (or null). */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

/** Whether this device already has a push subscription. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}
