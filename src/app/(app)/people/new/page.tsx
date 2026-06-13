import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { PersonForm } from "../_components/person-form";
import { createPersonAction } from "../actions";

export default async function NewPersonPage() {
  // Gate the route to an authenticated user (the action re-checks too).
  await requireUser();
  const t = await getTranslations("people");

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">{t("form.newTitle")}</h1>
      <PersonForm action={createPersonAction} cancelHref="/people" />
    </section>
  );
}
