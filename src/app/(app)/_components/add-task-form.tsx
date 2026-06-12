"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NATIVE_SELECT_CLASS } from "../people/_components/select-styles";
import { cn } from "@/lib/utils";
import { createTaskAction, type CreateTaskState } from "../today/actions";

const initialState: CreateTaskState = { status: "idle" };

/**
 * One-off task creator: title + due date, optional person + note. Submits via
 * useActionState to createTaskAction (which validates with zod and scopes by
 * the authenticated user). Field errors render inline; on success the form
 * resets and the new task appears in the feed via the action's revalidatePath.
 */
export function AddTaskForm({
  people,
}: {
  people: { id: string; fullName: string }[];
}) {
  const t = useTranslations("tasks");
  const [state, formAction, pending] = useActionState(
    createTaskAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  function errorFor(field: string) {
    const key = fieldErrors?.[field];
    return key ? <p className="text-sm text-destructive">{t("errors.invalid")}</p> : null;
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-xl border p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="task-title">{t("titleLabel")}</Label>
        <Input id="task-title" name="title" required maxLength={300} />
        {errorFor("title")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="task-due">{t("dueLabel")}</Label>
          <Input id="task-due" name="dueAt" type="date" required />
          {errorFor("dueAt")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-person">{t("personLabel")}</Label>
          <select
            id="task-person"
            name="personId"
            defaultValue=""
            className={cn(NATIVE_SELECT_CLASS, "w-full")}
          >
            <option value="">{t("none")}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-note">{t("noteLabel")}</Label>
        <Textarea id="task-note" name="note" rows={2} maxLength={2000} />
        {errorFor("note")}
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {t("add")}
      </Button>
    </form>
  );
}
