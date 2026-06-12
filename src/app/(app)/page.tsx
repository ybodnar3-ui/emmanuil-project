import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
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
  const now = new Date();

  const [items, people] = await Promise.all([
    getTodayFeed(user.id, now),
    listPeople(user.id),
  ]);

  return (
    <section className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>

      <AddTaskForm people={people.map((p) => ({ id: p.id, fullName: p.fullName }))} />

      {items.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <TodayFeed items={items} />
      )}
    </section>
  );
}
