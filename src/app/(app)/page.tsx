import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { getLocaleFromCookie } from "@/i18n/locale";
import { getTodayFeed } from "@/server/data/today";
import { listPeople } from "@/server/data/people";
import { TodayFeed } from "./_components/today-feed";
import { AddTaskForm } from "./_components/add-task-form";

/**
 * The Today tab. Server component: resolves the user, computes the feed live
 * (no cache, no cron — see the phase plan), and renders the add-task form plus
 * the ordered feed. The people list is loaded once here so the task form's
 * optional person picker doesn't need its own round-trip.
 */
export default async function TodayPage() {
  const t = await getTranslations("today");
  const user = await requireUser();
  const locale = await getLocaleFromCookie();
  const now = new Date();

  const [items, people] = await Promise.all([
    getTodayFeed(user.id, now, locale),
    listPeople(user.id),
  ]);

  return (
    <section className="space-y-7">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>

      <AddTaskForm people={people.map((p) => ({ id: p.id, fullName: p.fullName }))} />

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
