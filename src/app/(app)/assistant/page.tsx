import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { AssistantChat } from "./_components/assistant-chat";

export default async function AssistantPage() {
  await requireUser();
  const t = await getTranslations("assistant");
  return (
    <section className="flex h-full flex-col">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <AssistantChat />
    </section>
  );
}
