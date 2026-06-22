import { prisma } from "@/server/db";
import type { PushSubscriptionInput } from "@/server/validation/push";

/**
 * Push subscriptions are owned by a User (a user may install the PWA on several
 * devices → several rows). Every read/write is scoped by userId, except the
 * cron-only prune (deleteSubscriptionByEndpoint), which is keyed by the unique
 * endpoint a push service reports as gone — there is no user in that path.
 */

/** Upsert by endpoint: re-subscribing the same device updates its keys (and
 *  re-assigns it to this user). */
export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

/** Delete one of the caller's subscriptions. deleteMany with a userId+endpoint
 *  filter makes a cross-user (or stale) endpoint a no-op (count 0), never a throw. */
export async function deleteSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export function listSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({ where: { userId } });
}

/** Cron-only prune of a dead endpoint (push service returned 404/410 Gone). */
export async function deleteSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export type PushTarget = {
  userId: string;
  locale: string;
  subscriptions: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }[];
};

/** All users with ≥1 subscription, grouped, with their locale — for the daily
 *  cron. Selects only what sending needs. */
export async function listPushTargets(): Promise<PushTarget[]> {
  const rows = await prisma.pushSubscription.findMany({
    select: {
      endpoint: true,
      p256dh: true,
      auth: true,
      user: { select: { id: true, locale: true } },
    },
  });
  const byUser = new Map<string, PushTarget>();
  for (const r of rows) {
    let target = byUser.get(r.user.id);
    if (!target) {
      target = { userId: r.user.id, locale: r.user.locale, subscriptions: [] };
      byUser.set(r.user.id, target);
    }
    target.subscriptions.push({
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth },
    });
  }
  return [...byUser.values()];
}
