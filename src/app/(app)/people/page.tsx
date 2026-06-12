import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireUser } from "@/server/auth";
import { searchPeople } from "@/server/data/people";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PeopleSearch } from "./_components/people-search";
import { PersonAvatar } from "./_components/person-avatar";

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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
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
        <p className="mt-4 text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/people/${person.id}`}
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted"
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
                      <Badge variant="secondary" className="shrink-0">
                        {t(`tier.${person.relationshipTier}`)}
                      </Badge>
                    ) : null}
                  </div>
                  {person.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
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
