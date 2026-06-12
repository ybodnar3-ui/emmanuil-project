"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateBriefAction } from "../../actions";
import type { Brief } from "@/server/ai/brief";

type PanelState =
  | { status: "idle" }
  | { status: "ok"; brief: Brief }
  | { status: "error" };

/**
 * "What do I know?" control. On click it calls the ownership-scoped server
 * action, shows a loading state, then renders the structured brief. On failure
 * (any BriefResult error code, or an unexpected rejection) it shows a localized
 * message and lets the user retry. The brief is generated on demand, not
 * persisted.
 */
export function BriefPanel({ personId }: { personId: string }) {
  const t = useTranslations("people.brief");
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const result = await generateBriefAction(personId);
        if (result.status === "ok") {
          setState({ status: "ok", brief: result.brief });
        } else {
          setState({ status: "error" });
        }
      } catch {
        setState({ status: "error" });
      }
    });
  }

  const isRetry = state.status === "error" || state.status === "ok";

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending}
        aria-busy={pending}
      >
        <Sparkles />
        {pending ? t("loading") : isRetry ? t("retry") : t("button")}
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
        <div aria-busy={pending} className={pending ? "opacity-50" : undefined}>
          <BriefView brief={state.brief} />
        </div>
      ) : null}
    </div>
  );
}

function BriefView({ brief }: { brief: Brief }) {
  const t = useTranslations("people.brief");
  const hasContent =
    brief.summary ||
    brief.talkingPoints.length > 0 ||
    brief.askAbout.length > 0 ||
    brief.reconnectReason;

  return (
    <section
      role="region"
      aria-label={t("button")}
      className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm"
    >
      {!hasContent ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : null}

      {brief.summary ? (
        <div className="space-y-1">
          <h3 className="font-medium">{t("summary")}</h3>
          <p>{brief.summary}</p>
        </div>
      ) : null}

      {brief.talkingPoints.length > 0 ? (
        <div className="space-y-1">
          <h3 className="font-medium">{t("talkingPoints")}</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {brief.talkingPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief.askAbout.length > 0 ? (
        <div className="space-y-1">
          <h3 className="font-medium">{t("askAbout")}</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {brief.askAbout.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief.reconnectReason ? (
        <div className="space-y-1">
          <h3 className="font-medium">{t("reconnectReason")}</h3>
          <p>{brief.reconnectReason}</p>
        </div>
      ) : null}
    </section>
  );
}
