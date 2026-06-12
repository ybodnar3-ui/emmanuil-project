"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  connectTelegramAction,
  disconnectTelegramAction,
} from "../actions";

type State =
  | { status: "idle" }
  | { status: "link"; url: string }
  | { status: "error"; message: string };

/**
 * Settings control for linking a Telegram chat. The connected/not-connected
 * state is computed server-side (page reads user.telegramChatId) and passed in.
 *
 * Connect → server action mints a one-time code and returns a t.me deep link,
 * which we render with short instructions. Disconnect → server action clears the
 * link (the page re-renders via revalidatePath). All copy is next-intl; failures
 * degrade to a localized message and never surface the bot token.
 */
export function ConnectTelegram({ connected }: { connected: boolean }) {
  const t = useTranslations("settings.telegram");
  const [state, setState] = useState<State>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function connect() {
    startTransition(async () => {
      try {
        const res = await connectTelegramAction();
        if (res.status === "ok") {
          setState({ status: "link", url: res.url });
        } else {
          setState({ status: "error", message: res.message });
        }
      } catch {
        setState({ status: "error", message: "telegram.error" });
      }
    });
  }

  function disconnect() {
    // The action revalidates "/settings", so the page re-renders with
    // connected=false; no local state to flip here.
    startTransition(async () => {
      try {
        await disconnectTelegramAction();
      } catch {
        setState({ status: "error", message: "telegram.error" });
      }
    });
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("connected")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={disconnect}
          disabled={pending}
          aria-busy={pending}
        >
          {t("disconnect")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("notConnected")}</p>

      <Button
        type="button"
        size="sm"
        onClick={connect}
        disabled={pending}
        aria-busy={pending}
      >
        <Send />
        {t("connect")}
      </Button>

      {state.status === "error" ? (
        <p
          role="status"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.message === "telegram.notConfigured"
            ? t("notConfigured")
            : t("error")}
        </p>
      ) : null}

      {state.status === "link" ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
          <p>{t("instructions")}</p>
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("openBot")}
          </a>
        </div>
      ) : null}
    </div>
  );
}
