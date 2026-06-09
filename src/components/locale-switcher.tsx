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
            className={`rounded-md border px-3 py-1 text-sm uppercase ${
              loc === current ? "bg-foreground text-background" : "bg-background"
            }`}
          >
            {loc}
          </button>
        </form>
      ))}
    </div>
  );
}
