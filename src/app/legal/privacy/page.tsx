import { getLocaleFromCookie } from "@/i18n/locale";
import { PRIVACY, type LegalDoc } from "../content";

export default async function PrivacyPage() {
  const locale = await getLocaleFromCookie();
  const doc: LegalDoc = PRIVACY[locale === "uk" ? "uk" : "en"];
  return <LegalArticle doc={doc} />;
}

function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <article className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">{doc.title}</h1>
      {doc.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
