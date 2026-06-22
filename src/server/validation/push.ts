import { z } from "zod";

/**
 * Shape of a browser PushSubscription as returned by `subscription.toJSON()`.
 * We accept only the fields we store; `expirationTime` is ignored. The client is
 * never trusted — the server re-validates this before any DB write.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
