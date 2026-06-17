"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addKeyDateAction,
  deleteKeyDateAction,
  type FormState,
} from "../../actions";

const initialState: FormState = { status: "idle" };

export type KeyDateItem = { id: string; label: string; date: Date };

/**
 * The Person card's "Key dates" section: lists each labeled date (UTC-formatted)
 * with a delete control, plus an add form (label + date). Mirrors the Facts
 * section. Persistence is ownership-checked server-side (addKeyDate/deleteKeyDate);
 * the date input value is a YYYY-MM-DD string coerced + validated by zod.
 */
export function KeyDates({
  personId,
  items,
}: {
  personId: string;
  items: KeyDateItem[];
}) {
  const t = useTranslations("people");
  const tRoot = useTranslations();
  const format = useFormatter();
  const action = addKeyDateAction.bind(null, personId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const message = state.status === "error" ? state.message : undefined;

  // Clear the inputs after a successful add.
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  // Format in UTC: a key date is a calendar fact, not a wall-clock instant (same
  // convention as the rest of the app's date handling).
  const fmtDate = (d: Date) =>
    format.dateTime(d, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("keyDates.none")}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((kd) => (
            <li
              key={kd.id}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <span className="flex-1">
                <span className="font-medium">{kd.label}</span>{" "}
                <span className="text-muted-foreground">
                  · {fmtDate(kd.date)}
                </span>
              </span>
              <form action={deleteKeyDateAction}>
                <input type="hidden" name="keyDateId" value={kd.id} />
                <input type="hidden" name="personId" value={personId} />
                <Button
                  type="submit"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("keyDates.delete")}
                >
                  <X />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="keydate-label" className="sr-only">
            {t("keyDates.label")}
          </Label>
          <Input
            id="keydate-label"
            name="label"
            required
            placeholder={t("keyDates.label")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="keydate-date" className="sr-only">
            {t("keyDates.dateLabel")}
          </Label>
          <Input id="keydate-date" name="date" type="date" required />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {t("keyDates.add")}
        </Button>
      </form>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {tRoot(message)}
        </p>
      ) : null}
    </div>
  );
}
