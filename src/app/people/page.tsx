import { getTranslations } from "next-intl/server";

export default async function PeoplePage() {
  const t = await getTranslations("people");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("empty")}</p>
    </section>
  );
}
