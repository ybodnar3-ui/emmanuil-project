import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { getLocaleFromCookie } from "@/i18n/locale";
import { getTodayFeed } from "@/server/data/today";
import { TodayFeed } from "./_components/today-feed";

/**
 * The home tab: "people to reconnect with". Server component — resolves the
 * user, reads the locale (for the per-contact personalized prompt), computes
 * the feed live, and renders the ordered, person-centric list. No add-task form
 * and no generic tasks: reminders are created from a person's card and surface
 * here under their person.
 */
export default async function TodayPage() {
  const t = await getTranslations("today");
  const user = await requireUser();
  const locale = await getLocaleFromCookie();
  const now = new Date();

  const items = await getTodayFeed(user.id, now, locale);

  return (
    <section className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <p className="font-heading text-xl text-foreground">{t("empty")}</p>
        </div>
      ) : (
        <TodayFeed items={items} />
      )}
    </section>
  );
}
