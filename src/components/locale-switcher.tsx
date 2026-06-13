import { getLocaleFromCookie, LOCALES } from "@/i18n/locale";
import { setLocale } from "@/app/actions/locale";

export async function LocaleSwitcher() {
  const current = await getLocaleFromCookie();
  return (
    <div className="flex gap-2">
      {LOCALES.map((loc) => (
        <form key={loc} action={setLocale.bind(null, loc)}>
          <button
            type="submit"
            aria-pressed={loc === current}
            className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium uppercase tracking-wide transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${
              loc === current
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            }`}
          >
            {loc}
          </button>
        </form>
      ))}
    </div>
  );
}
