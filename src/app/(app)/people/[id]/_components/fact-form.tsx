"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FACT_CATEGORIES } from "@/server/validation/person";
import { addFactAction, type FormState } from "../../actions";

const initialState: FormState = { status: "idle" };

/** Add-fact control. Defaults the category to the section it's rendered under. */
export function FactForm({
  personId,
  defaultCategory,
}: {
  personId: string;
  defaultCategory: (typeof FACT_CATEGORIES)[number];
}) {
  const t = useTranslations("people");
  const action = addFactAction.bind(null, personId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input after a successful add.
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex gap-2">
      <input type="hidden" name="category" value={defaultCategory} />
      <Label htmlFor={`fact-${defaultCategory}`} className="sr-only">
        {t("facts.content")}
      </Label>
      <Input
        id={`fact-${defaultCategory}`}
        name="content"
        required
        placeholder={t("facts.add")}
        className="flex-1"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("facts.add")}
      </Button>
    </form>
  );
}
