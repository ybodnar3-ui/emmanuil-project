import { useTranslations } from "next-intl";

export default function PeoplePage() {
  const t = useTranslations("people");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("empty")}</p>
    </section>
  );
}
