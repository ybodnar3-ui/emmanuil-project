import { useTranslations } from "next-intl";

export default function AssistantPage() {
  const t = useTranslations("assistant");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("placeholder")}</p>
    </section>
  );
}
