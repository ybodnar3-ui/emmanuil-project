"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setCadenceAction,
  clearCadenceAction,
  type FormState,
} from "../../actions";
import { INTERVAL_PRESETS } from "@/server/cadence";

const initialState: FormState = { status: "idle" };

export function CadenceForm({
  personId,
  currentIntervalDays,
}: {
  personId: string;
  currentIntervalDays?: number;
}) {
  const t = useTranslations("people");
  const action = setCadenceAction.bind(null, personId);
  const [, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="intervalDays">{t("cadence.interval")}</Label>
          <Input
            id="intervalDays"
            name="intervalDays"
            type="number"
            min={1}
            max={3650}
            required
            list="cadence-presets"
            defaultValue={currentIntervalDays ?? ""}
          />
          <datalist id="cadence-presets">
            {INTERVAL_PRESETS.map((days) => (
              <option key={days} value={days} />
            ))}
          </datalist>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {currentIntervalDays ? t("cadence.update") : t("cadence.set")}
        </Button>
      </form>

      {currentIntervalDays ? (
        <form action={clearCadenceAction}>
          <input type="hidden" name="personId" value={personId} />
          <Button type="submit" size="sm" variant="ghost">
            {t("cadence.clear")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
