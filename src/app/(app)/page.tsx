import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { getLocaleFromCookie } from "@/i18n/locale";
import { getTodayFeed } from "@/server/data/today";
import { countPeople } from "@/server/data/people";
import { EmptyState } from "./_components/empty-state";
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
  // Distinguish a brand-new user (no people yet) from a returning user with a
  // quiet day, so the empty state can guide the former and reassure the latter.
  // Short-circuit so we never run the extra count when the feed is non-empty.
  const hasPeople = items.length > 0 ? true : (await countPeople(user.id)) > 0;

  return (
    <section className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {items.length === 0 ? (
        hasPeople ? (
          <EmptyState title={t("empty")} />
        ) : (
          <EmptyState
            title={t("emptyNewTitle")}
            description={t("emptyNewHint")}
            action={{ href: "/people/new", label: t("emptyNewCta") }}
          />
        )
      ) : (
        <TodayFeed items={items} />
      )}
    </section>
  );
}
