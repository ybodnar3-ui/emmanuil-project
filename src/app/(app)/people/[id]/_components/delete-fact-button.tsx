"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteFactAction } from "../../actions";

export function DeleteFactButton({
  factId,
  personId,
}: {
  factId: string;
  personId: string;
}) {
  const t = useTranslations("people");
  return (
    <form action={deleteFactAction}>
      <input type="hidden" name="factId" value={factId} />
      <input type="hidden" name="personId" value={personId} />
      <Button
        type="submit"
        size="icon-xs"
        variant="ghost"
        aria-label={t("facts.delete")}
      >
        <X />
      </Button>
    </form>
  );
}
