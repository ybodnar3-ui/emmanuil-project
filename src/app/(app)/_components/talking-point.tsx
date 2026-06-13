"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestTalkingPointAction } from "../today/actions";

type State =
  | { status: "idle" }
  | { status: "ok"; suggestion: string }
  | { status: "error" };

/**
 * "What to say?" control. On click it calls the ownership-scoped server action
 * (which makes the paid AI call), shows a loading state, then renders the one-
 * line suggestion. On-demand only — nothing fires on render, so no paid call
 * happens until the user asks. Any failure degrades to a localized message.
 */
export function TalkingPoint({
  personId,
  occasion,
}: {
  personId: string;
  occasion: string;
}) {
  const t = useTranslations("today.talkingPoint");
  const [state, setState] = useState<State>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const result = await suggestTalkingPointAction(personId, occasion);
        if (result.status === "ok") {
          setState({ status: "ok", suggestion: result.suggestion });
        } else {
          setState({ status: "error" });
        }
      } catch {
        setState({ status: "error" });
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending}
        aria-busy={pending}
      >
        <Sparkles />
        {pending ? t("loading") : t("button")}
      </Button>

      {state.status === "error" ? (
        <p
          role="status"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t("error")}
        </p>
      ) : null}

      {state.status === "ok" ? (
        <p className="rounded-xl border border-border bg-accent/40 px-3 py-2 text-sm leading-relaxed">
          {state.suggestion}
        </p>
      ) : null}
    </div>
  );
}
