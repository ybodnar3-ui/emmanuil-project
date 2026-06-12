import { getRequestConfig } from "next-intl/server";
import { getLocaleFromCookie } from "./locale";

export default getRequestConfig(async () => {
  const locale = await getLocaleFromCookie();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Birthdays/interaction dates are stored at UTC midnight. Formatting in the
    // process timezone would shift them a day in negative-UTC-offset zones, so we
    // pin all date formatting to UTC for consistent display everywhere.
    timeZone: "UTC",
  };
});
