import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { getPerson } from "@/server/data/people";
import { PersonForm } from "../../_components/person-form";
import { updatePersonAction } from "../../actions";

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const person = await getPerson(user.id, id);
  if (!person) notFound();

  const t = await getTranslations("people");

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("form.editTitle")}</h1>
      <PersonForm
        action={updatePersonAction.bind(null, person.id)}
        cancelHref={`/people/${person.id}`}
        initial={{
          id: person.id,
          fullName: person.fullName,
          howWeMet: person.howWeMet,
          location: person.location,
          birthday: person.birthday,
          tags: person.tags,
          relationshipTier: person.relationshipTier,
          photoUrl: person.photoUrl,
        }}
      />
    </section>
  );
}
