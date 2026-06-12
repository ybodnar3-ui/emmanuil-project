"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyProposalAction } from "../actions";

export type Proposal = {
  personId: string;
  personName: string;
  facts: { category: string; content: string }[];
  interaction: { summary: string; channel?: string | null } | null;
};

/**
 * Renders a capture proposal with Confirm / Dismiss. NOTHING is persisted until
 * Confirm calls applyProposalAction. On success it shows a confirmation plus a
 * link to the person card; on failure it shows a localized error and stays
 * confirmable so the user can retry. Dismiss removes the card without writing.
 */
export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const t = useTranslations("assistant");
  const tFact = useTranslations("people.factCategory");
  const tChannel = useTranslations("people.channel");
  const [state, setState] = useState<"open" | "applied" | "dismissed" | "error">(
    "open",
  );
  const [pending, startTransition] = useTransition();

  if (state === "dismissed") return null;

  function confirm() {
    startTransition(async () => {
      try {
        const res = await applyProposalAction({
          personId: proposal.personId,
          facts: proposal.facts,
          interaction: proposal.interaction,
        });
        setState(res.status === "ok" ? "applied" : "error");
      } catch {
        setState("error");
      }
    });
  }

  if (state === "applied") {
    return (
      <div
        role="status"
        className="space-y-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm"
      >
        <p>{t("proposal.applied")}</p>
        <Link
          href={`/people/${proposal.personId}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {t("proposal.viewPerson")}
        </Link>
      </div>
    );
  }

  return (
    <section
      aria-label={t("proposal.title")}
      className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm"
    >
      <h3 className="font-medium">
        {t("proposal.title")} · {proposal.personName}
      </h3>

      {proposal.facts.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5">
          {proposal.facts.map((f, i) => (
            <li key={i}>
              <span className="text-muted-foreground">{tFact(f.category)}:</span>{" "}
              {f.content}
            </li>
          ))}
        </ul>
      ) : null}

      {proposal.interaction ? (
        <p>
          {proposal.interaction.channel ? (
            <span className="text-muted-foreground">
              {tChannel(proposal.interaction.channel)}:{" "}
            </span>
          ) : null}
          {proposal.interaction.summary}
        </p>
      ) : null}

      {state === "error" ? (
        <p role="status" className="text-destructive">
          {t("errors.generic")}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={confirm}
          disabled={pending}
          aria-busy={pending}
        >
          <Check />
          {t("proposal.confirm")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setState("dismissed")}
          disabled={pending}
        >
          <X />
          {t("proposal.dismiss")}
        </Button>
      </div>
    </section>
  );
}
