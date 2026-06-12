import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/server/auth";
import { ConnectTelegram } from "./_components/connect-telegram";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  // Telegram link state is read server-side (never trust the client) and passed
  // into the client control as a plain boolean.
  const user = await requireUser();
  const telegramConnected = Boolean(user.telegramChatId);
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{t("language")}</p>
        <LocaleSwitcher />
      </div>
      <div className="mt-8">
        <p className="mb-2 text-sm font-medium">{t("telegram.title")}</p>
        <ConnectTelegram connected={telegramConnected} />
      </div>
      <div className="mt-8">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("signOut")}
          </button>
        </form>
      </div>
    </section>
  );
}
