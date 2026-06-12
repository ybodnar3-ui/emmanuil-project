"use client";

import { useTransition } from "react";
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
} from "../today/actions";
import { TalkingPoint } from "./talking-point";

/**
 * One feed row with its action buttons. Uses useTransition so the buttons
 * disable while the server action runs; on success the action's revalidatePath
 * refreshes the feed (the done/snoozed item drops out on the next render), so
 * there is no local optimistic state to manage. Person-linked items also get an
 * on-demand "what to say" control.
 */
export function FeedItemCard({ item }: { item: FeedItem }) {
  const t = useTranslations("today");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
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

          {personIdFor(item) ? (
            <Button
              render={<Link href={`/people/${personIdFor(item)}`} />}
              nativeButton={false}
              size="sm"
              variant="ghost"
            >
              {t("viewPerson")}
            </Button>
          ) : null}
        </div>

        {personIdFor(item) ? (
          <TalkingPoint
            personId={personIdFor(item) as string}
            occasion={occasionFor(item, t)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

type TFn = (key: string, values?: Record<string, string | number>) => string;

function titleFor(item: FeedItem): string {
  return item.type === "task" ? item.title : item.personName;
}

function personIdFor(item: FeedItem): string | null {
  // contact/birthday always carry personId; task's is nullable.
  return item.personId;
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

/** Natural-language reason handed to the AI suggestion (in the user's locale). */
function occasionFor(item: FeedItem, t: TFn): string {
  if (item.type === "birthday") {
    return item.inDays === 0
      ? t("birthdayToday")
      : t("birthdayInDays", { days: item.inDays });
  }
  if (item.type === "task") return item.title;
  return t("section.contacts");
}
