import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getPerson } from "@/server/data/people";
import { FACT_CATEGORIES } from "@/server/validation/person";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonAvatar } from "../_components/person-avatar";
import { TierBadge } from "../_components/tier-badge";
import { FactForm } from "./_components/fact-form";
import { DeleteFactButton } from "./_components/delete-fact-button";
import { InteractionForm } from "./_components/interaction-form";
import { CadenceForm } from "./_components/cadence-form";
import { DeletePersonButton } from "./_components/delete-person-button";
import { BriefPanel } from "./_components/brief-panel";

export default async function PersonCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photoError?: string }>;
}) {
  const { id } = await params;
  // Next 16: searchParams is a Promise. A failed photo upload during create/edit
  // redirects here with ?photoError=1 so we can show a non-blocking notice.
  const { photoError } = await searchParams;
  const user = await requireUser();
  const person = await getPerson(user.id, id);
  if (!person) notFound();

  const t = await getTranslations("people");
  const format = await getFormatter();
  const fmtDate = (d: Date) => format.dateTime(d, { dateStyle: "medium" });

  const factsByCategory = Object.fromEntries(
    FACT_CATEGORIES.map((category) => [
      category,
      person.facts.filter((fact) => fact.category === category),
    ]),
  );

  return (
    <section className="space-y-6">
      {photoError ? (
        <p
          role="status"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t("errors.photoUpload")}
        </p>
      ) : null}

      {/* Header */}
      <div className="flex items-start gap-4">
        <PersonAvatar
          fullName={person.fullName}
          photoUrl={person.photoUrl}
          className="size-16 text-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-3xl font-semibold">
              {person.fullName}
            </h1>
            {person.relationshipTier ? (
              <TierBadge
                tier={person.relationshipTier}
                label={t(`tier.${person.relationshipTier}`)}
              />
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {person.location || t("card.noLocation")}
          </p>
          {person.birthday ? (
            <p className="text-sm text-muted-foreground">
              {t("card.birthday")}: {fmtDate(person.birthday)}
            </p>
          ) : null}
          {person.tags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {person.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/people/${person.id}/edit`} />}
        >
          <Pencil />
          {t("card.edit")}
        </Button>
        <DeletePersonButton personId={person.id} />
      </div>

      {/* AI brief — generated on demand from this person's own data. */}
      <BriefPanel personId={person.id} />

      {person.howWeMet ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-4 text-sm leading-relaxed whitespace-pre-line shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
          {person.howWeMet}
        </p>
      ) : null}

      {/* Cadence */}
      <Card>
        <CardHeader>
          <CardTitle>{t("cadence.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {person.cadence ? (
            <p className="text-sm text-muted-foreground">
              {t("cadence.everyDays", { days: person.cadence.intervalDays })} ·{" "}
              {t("cadence.nextDue", { date: fmtDate(person.cadence.nextDueAt) })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("cadence.none")}</p>
          )}
          <CadenceForm
            personId={person.id}
            currentIntervalDays={person.cadence?.intervalDays}
          />
        </CardContent>
      </Card>

      {/* Facts grouped by category */}
      <Card>
        <CardHeader>
          <CardTitle>{t("facts.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {person.facts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("facts.empty")}</p>
          ) : null}
          {FACT_CATEGORIES.map((category) => {
            const facts = factsByCategory[category]!;
            return (
              <div key={category} className="space-y-2">
                <h3 className="text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {t(`factCategory.${category}`)}
                </h3>
                {facts.length > 0 ? (
                  <ul className="space-y-1">
                    {facts.map((fact) => (
                      <li
                        key={fact.id}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <span className="flex-1">{fact.content}</span>
                        <DeleteFactButton
                          factId={fact.id}
                          personId={person.id}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <FactForm personId={person.id} defaultCategory={category} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Interactions timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t("interactions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InteractionForm personId={person.id} />
          {person.interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("interactions.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {person.interactions.map((interaction) => (
                <li
                  key={interaction.id}
                  className="border-l-2 border-primary/30 pl-3 text-sm"
                >
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(interaction.date)}
                    {interaction.channel
                      ? ` · ${t(`channel.${interaction.channel}`)}`
                      : ""}
                  </div>
                  <p className="whitespace-pre-line">{interaction.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
