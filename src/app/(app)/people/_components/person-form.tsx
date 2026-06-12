"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RELATIONSHIP_TIERS } from "@/server/validation/person";
import type { FormState } from "../actions";

type PersonFormInitial = {
  id: string;
  fullName: string;
  howWeMet: string | null;
  location: string | null;
  birthday: Date | string | null;
  tags: string[];
  relationshipTier: string | null;
  photoUrl: string | null;
};

const initialState: FormState = { status: "idle" };

/** Format a Date|string into the YYYY-MM-DD a <input type="date"> expects. */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function PersonForm({
  action,
  initial,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: PersonFormInitial;
  cancelHref: string;
}) {
  const t = useTranslations("people");
  const [state, formAction, pending] = useActionState(action, initialState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  function errorFor(field: string) {
    const key = fieldErrors?.[field];
    return key ? <p className="text-sm text-destructive">{t(key)}</p> : null;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t("form.fullName")}</Label>
        <Input
          id="fullName"
          name="fullName"
          required
          defaultValue={initial?.fullName ?? ""}
          aria-invalid={Boolean(fieldErrors?.fullName)}
        />
        {errorFor("fullName")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="relationshipTier">{t("form.relationshipTier")}</Label>
        <select
          id="relationshipTier"
          name="relationshipTier"
          defaultValue={initial?.relationshipTier ?? ""}
          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
        >
          <option value="">{t("form.tierNone")}</option>
          {RELATIONSHIP_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {t(`tier.${tier}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">{t("form.location")}</Label>
        <Input
          id="location"
          name="location"
          defaultValue={initial?.location ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="birthday">{t("form.birthday")}</Label>
        <Input
          id="birthday"
          name="birthday"
          type="date"
          defaultValue={toDateInput(initial?.birthday ?? null)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags">{t("form.tags")}</Label>
        <Input
          id="tags"
          name="tags"
          defaultValue={initial?.tags?.join(", ") ?? ""}
          placeholder={t("form.tagsHint")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="howWeMet">{t("form.howWeMet")}</Label>
        <Textarea
          id="howWeMet"
          name="howWeMet"
          rows={3}
          defaultValue={initial?.howWeMet ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photo">{t("form.photo")}</Label>
        <Input id="photo" name="photo" type="file" accept="image/*" />
        {errorFor("photo")}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("form.saving") : t("form.save")}
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={cancelHref} />}
        >
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}
