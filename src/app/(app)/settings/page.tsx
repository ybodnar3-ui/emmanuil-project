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
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
        <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {t("language")}
        </p>
        <LocaleSwitcher />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
        <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {t("telegram.title")}
        </p>
        <ConnectTelegram connected={telegramConnected} />
      </div>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("signOut")}
        </button>
      </form>
    </section>
  );
}
