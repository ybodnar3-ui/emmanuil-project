"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pushSupported,
  isIosNotStandalone,
  subscribeToPush,
  unsubscribeFromPush,
  currentSubscription,
} from "@/lib/push-client";
import { subscribePushAction, unsubscribePushAction } from "../actions";

type View =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "not-configured" }
  | { kind: "ios-hint" }
  | { kind: "subscribed" }
  | { kind: "not-subscribed" }
  | { kind: "error"; message: "denied" | "error" };

/**
 * Per-device push control. The server never knows whether THIS browser is
 * subscribed (subscriptions are per endpoint), so the state is read from the
 * browser's PushManager on mount. Enable → register SW + permission + subscribe
 * + POST to the server. Disable → unsubscribe + tell the server to drop the row.
 */
export function PushNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const t = useTranslations("settings.push");
  const [view, setView] = useState<View>({ kind: "loading" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Resolve the initial per-device state asynchronously so the effect never
    // calls setState synchronously in its body (react-hooks/set-state-in-effect).
    let cancelled = false;
    async function resolveView(): Promise<View> {
      if (!vapidPublicKey) return { kind: "not-configured" };
      if (!pushSupported()) {
        return isIosNotStandalone() ? { kind: "ios-hint" } : { kind: "unsupported" };
      }
      const sub = await currentSubscription();
      return sub ? { kind: "subscribed" } : { kind: "not-subscribed" };
    }
    resolveView().then((next) => {
      if (!cancelled) setView(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  function enable() {
    startTransition(async () => {
      try {
        const json = await subscribeToPush(vapidPublicKey);
        if (!json) return setView({ kind: "error", message: "denied" });
        const res = await subscribePushAction(json);
        setView(res.status === "ok" ? { kind: "subscribed" } : { kind: "error", message: "error" });
      } catch {
        setView({ kind: "error", message: "error" });
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await unsubscribePushAction(endpoint);
        setView({ kind: "not-subscribed" });
      } catch {
        setView({ kind: "error", message: "error" });
      }
    });
  }

  if (view.kind === "loading") return null;
  if (view.kind === "unsupported")
    return <p className="text-sm text-muted-foreground">{t("unsupported")}</p>;
  if (view.kind === "not-configured")
    return <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>;
  if (view.kind === "ios-hint")
    return <p className="text-sm text-muted-foreground">{t("iosHint")}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {view.kind === "subscribed" ? t("enabled") : t("disabled")}
      </p>
      {view.kind === "subscribed" ? (
        <Button type="button" variant="outline" size="sm" onClick={disable} disabled={pending} aria-busy={pending}>
          {t("disable")}
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={enable} disabled={pending} aria-busy={pending}>
          <Bell />
          {t("enable")}
        </Button>
      )}
      {view.kind === "error" ? (
        <p role="status" className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(view.message)}
        </p>
      ) : null}
    </div>
  );
}
