import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireUser } from "@/server/auth";
import { searchPeople } from "@/server/data/people";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "../_components/empty-state";
import { PeopleSearch } from "./_components/people-search";
import { PersonAvatar } from "./_components/person-avatar";
import { TierBadge } from "./_components/tier-badge";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; tier?: string }>;
}) {
  const t = await getTranslations("people");
  const { q, tag, tier } = await searchParams;
  const user = await requireUser();
  const people = await searchPeople(user.id, { query: q, tag, tier });

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Button
          render={<Link href="/people/new" />}
          nativeButton={false}
          size="sm"
        >
          <Plus />
          {t("add")}
        </Button>
      </div>

      <PeopleSearch />

      {people.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyHint")}
          action={{ href: "/people/new", label: t("add") }}
          secondary={{ href: "/assistant", label: t("emptyAssistant") }}
        />
      ) : (
        <ul className="ql-stagger divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/people/${person.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-accent"
              >
                <PersonAvatar
                  fullName={person.fullName}
                  photoUrl={person.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {person.fullName}
                    </span>
                    {person.relationshipTier ? (
                      <TierBadge tier={person.relationshipTier} label={t(`tier.${person.relationshipTier}`)} />
                    ) : null}
                  </div>
                  {person.tags.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {person.tags.map((tagName) => (
                        <Badge
                          key={tagName}
                          variant="outline"
                          className="text-xs"
                        >
                          {tagName}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
