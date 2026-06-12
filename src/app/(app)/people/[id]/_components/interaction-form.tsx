"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { INTERACTION_CHANNELS } from "@/server/validation/person";
import { logInteractionAction, type FormState } from "../../actions";
import { NATIVE_SELECT_CLASS } from "../../_components/select-styles";

const initialState: FormState = { status: "idle" };

export function InteractionForm({ personId }: { personId: string }) {
  const t = useTranslations("people");
  const action = logInteractionAction.bind(null, personId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor="summary" className="sr-only">
          {t("interactions.summary")}
        </Label>
        <Textarea
          id="summary"
          name="summary"
          required
          rows={2}
          placeholder={t("interactions.summary")}
        />
      </div>
      <div className="flex gap-2">
        <Input
          name="date"
          type="date"
          aria-label={t("interactions.date")}
          className="flex-1"
        />
        <select
          name="channel"
          aria-label={t("interactions.channel")}
          defaultValue=""
          className={NATIVE_SELECT_CLASS}
        >
          <option value="">{t("channel.none")}</option>
          {INTERACTION_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {t(`channel.${channel}`)}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          {t("interactions.log")}
        </Button>
      </div>
    </form>
  );
}
