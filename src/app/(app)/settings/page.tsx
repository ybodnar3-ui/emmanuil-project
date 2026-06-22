import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { PushNotifications } from "./_components/push-notifications";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tLegal = await getTranslations("legal");
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
          {t("push.title")}
        </p>
        <PushNotifications
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
        <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {tLegal("title")}
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/legal/privacy" className="text-primary underline-offset-4 hover:underline">
            {tLegal("privacy")}
          </Link>
          <Link href="/legal/terms" className="text-primary underline-offset-4 hover:underline">
            {tLegal("terms")}
          </Link>
        </div>
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
