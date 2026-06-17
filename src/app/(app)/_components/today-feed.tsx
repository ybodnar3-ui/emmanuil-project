import { getTranslations } from "next-intl/server";
import type { FeedItem } from "@/server/today/feed";
import { FeedItemCard } from "./feed-item-card";

/**
 * Renders the assembled feed grouped by type (people to reconnect with →
 * birthdays → follow-ups), each section labelled via next-intl. Server
 * component: it only lays out and labels; the per-item actions live in the
 * client <FeedItemCard>. Within each group the items keep the urgency order
 * assembleTodayFeed produced.
 */
export async function TodayFeed({ items }: { items: FeedItem[] }) {
  const t = await getTranslations("today");

  const contacts = items.filter((i) => i.type === "contact");
  // Birthdays + key dates share one "Birthdays & dates" section; they're already
  // interleaved by inDays in the assembled feed, so preserve that order here.
  const dates = items.filter(
    (i) => i.type === "birthday" || i.type === "keydate",
  );
  const tasks = items.filter((i) => i.type === "task");

  return (
    <div className="space-y-7">
      {contacts.length > 0 ? (
        <FeedSection title={t("section.reconnect")} items={contacts} />
      ) : null}
      {dates.length > 0 ? (
        <FeedSection title={t("section.dates")} items={dates} />
      ) : null}
      {tasks.length > 0 ? (
        <FeedSection title={t("section.followUps")} items={tasks} />
      ) : null}
    </div>
  );
}

function FeedSection({ title, items }: { title: string; items: FeedItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="ql-stagger space-y-3">
        {items.map((item) => (
          <li key={keyFor(item)}>
            <FeedItemCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function keyFor(item: FeedItem): string {
  if (item.type === "task") return `task-${item.taskId}`;
  // A person can have multiple key dates; the row id is the stable key.
  if (item.type === "keydate") return `keydate-${item.id}`;
  return `${item.type}-${item.personId}`;
}
