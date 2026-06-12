"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePersonAction } from "../../actions";

/**
 * Delete control. Confirms in the browser before submitting; the actual delete is
 * a server action that re-checks ownership and redirects to /people.
 */
export function DeletePersonButton({ personId }: { personId: string }) {
  const t = useTranslations("people");
  return (
    <form
      action={deletePersonAction}
      onSubmit={(e) => {
        if (!window.confirm(t("card.deleteConfirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="personId" value={personId} />
      <Button type="submit" variant="destructive" size="sm">
        <Trash2 />
        {t("card.delete")}
      </Button>
    </form>
  );
}
