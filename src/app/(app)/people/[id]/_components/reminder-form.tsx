"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReminderAction, type FormState } from "../../actions";

const initialState: FormState = { status: "idle" };

/**
 * "Set a reminder" on the person card: what to remember + a date. personId is
 * bound into the action (createReminderAction.bind(null, personId)) so the
 * reminder is always anchored to this person — there is no person picker, and
 * no generic add-task anywhere. On success the form resets; the reminder shows
 * on the home feed via the action's revalidatePath.
 */
export function ReminderForm({ personId }: { personId: string }) {
  const t = useTranslations("people");
  const tRoot = useTranslations();
  const action = createReminderAction.bind(null, personId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const message = state.status === "error" ? state.message : undefined;

  function errorFor(field: string) {
    const value = fieldErrors?.[field];
    if (!value) return null;
    // Bare `people`-relative key (e.g. "reminder.errors.invalid").
    return <p className="text-sm text-destructive">{t(value)}</p>;
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="reminder-title">{t("reminder.label")}</Label>
        <Input
          id="reminder-title"
          name="title"
          required
          maxLength={300}
          placeholder={t("reminder.placeholder")}
        />
        {errorFor("title")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reminder-due">{t("reminder.dateLabel")}</Label>
        <Input id="reminder-due" name="dueAt" type="date" required />
        {errorFor("dueAt")}
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {t("reminder.add")}
      </Button>

      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {tRoot(message)}
        </p>
      ) : null}
    </form>
  );
}
