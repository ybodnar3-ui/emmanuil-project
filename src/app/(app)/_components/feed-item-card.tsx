"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FeedItem } from "@/server/today/feed";
import {
  markContactedAction,
  snoozeContactAction,
  completeTaskAction,
  snoozeTaskAction,
  type ActionResult,
} from "../today/actions";

/**
 * One feed row with its action buttons. Uses useTransition so the buttons
 * disable while the server action runs; on success the action's revalidatePath
 * refreshes the feed (the done/snoozed item drops out on the next render), so
 * there is no local optimistic state to manage.
 *
 * A due contact shows its personalized "what to ask" baked in (item.prompt,
 * generated once per cadence cycle) — no on-demand AI call on the home page.
 * A reminder (task) shows under its person.
 */
export function FeedItemCard({ item }: { item: FeedItem }) {
  const t = useTranslations("today");
  const [pending, startTransition] = useTransition();
  const [errored, setErrored] = useState(false);
  const pid = item.personId;

  // Actions return a stable error result (e.g. NOT_FOUND if the person/task was
  // deleted between render and click) instead of throwing; surface it inline.
  function run(action: () => Promise<ActionResult>) {
    setErrored(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "error") setErrored(true);
      } catch {
        setErrored(true);
      }
    });
  }

  return (
    <Card size="sm">
      <CardContent className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="font-medium">{titleFor(item)}</p>
            <p className="text-xs text-muted-foreground">{subtitleFor(item, t)}</p>
          </div>
        </div>

        {item.type === "contact" ? (
          <p className="rounded-xl border border-border bg-accent/40 px-3 py-2 text-sm leading-relaxed">
            {item.prompt}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {item.type === "contact" ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => markContactedAction(item.personId))}
              >
                {t("done")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => snoozeContactAction(item.personId, 3))}
              >
                {t("snooze3d")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => snoozeContactAction(item.personId, 7))}
              >
                {t("snooze7d")}
              </Button>
            </>
          ) : null}

          {item.type === "task" ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => completeTaskAction(item.taskId))}
              >
                {t("done")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => snoozeTaskAction(item.taskId, 3))}
              >
                {t("snooze3d")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => snoozeTaskAction(item.taskId, 7))}
              >
                {t("snooze7d")}
              </Button>
            </>
          ) : null}

          {pid ? (
            <Button
              render={<Link href={`/people/${pid}`} />}
              nativeButton={false}
              size="sm"
              variant="ghost"
            >
              {t("viewPerson")}
            </Button>
          ) : null}
        </div>

        {errored ? (
          <p
            role="status"
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t("errors.notFound")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type TFn = (key: string, values?: Record<string, string | number>) => string;

function titleFor(item: FeedItem): string {
  return item.type === "task" ? item.title : item.personName;
}

function subtitleFor(item: FeedItem, t: TFn): string {
  if (item.type === "birthday") {
    return item.inDays === 0
      ? t("birthdayToday")
      : t("birthdayInDays", { days: item.inDays });
  }
  // contact or task — both carry overdueDays
  return item.overdueDays === 0
    ? t("dueToday")
    : t("overdue", { days: item.overdueDays });
}
