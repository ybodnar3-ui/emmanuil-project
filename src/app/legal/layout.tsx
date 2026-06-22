import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EFFECTIVE_DATE } from "./content";

/**
 * Shared layout for the public legal pages. Renders the Quiet-Luxury container,
 * the "not legal advice" draft notice, the effective date, and a back link. The
 * pages themselves render the locale-specific content.
 */
export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("legal");
  return (
    <section className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/login"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>
      <p className="mt-4 rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm text-muted-foreground">
        {t("draftNotice")}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("effective", { date: EFFECTIVE_DATE })}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
