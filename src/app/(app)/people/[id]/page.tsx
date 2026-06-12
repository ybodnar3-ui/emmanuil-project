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
import { FactForm } from "./_components/fact-form";
import { DeleteFactButton } from "./_components/delete-fact-button";
import { InteractionForm } from "./_components/interaction-form";
import { CadenceForm } from "./_components/cadence-form";
import { DeletePersonButton } from "./_components/delete-person-button";

export default async function PersonCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      {/* Header */}
      <div className="flex items-start gap-3">
        <PersonAvatar
          fullName={person.fullName}
          photoUrl={person.photoUrl}
          className="size-14"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold">
              {person.fullName}
            </h1>
            {person.relationshipTier ? (
              <Badge variant="secondary">
                {t(`tier.${person.relationshipTier}`)}
              </Badge>
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
          render={<Link href={`/people/${person.id}/edit`} />}
        >
          <Pencil />
          {t("card.edit")}
        </Button>
        <DeletePersonButton personId={person.id} />
        {/* Phase 4 placeholder — AI brief is not built here. */}
        <Button variant="ghost" size="sm" disabled title={t("card.aiBriefSoon")}>
          {t("card.aiBrief")}
        </Button>
      </div>

      {person.howWeMet ? (
        <p className="text-sm whitespace-pre-line">{person.howWeMet}</p>
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
              <div key={category} className="space-y-1.5">
                <h3 className="text-sm font-medium">
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
                <li key={interaction.id} className="border-l-2 pl-3 text-sm">
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
