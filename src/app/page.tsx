import { getTranslations } from "next-intl/server";

export default async function TodayPage() {
  const t = await getTranslations("today");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("empty")}</p>
    </section>
  );
}
