"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/client-error";

/**
 * Root-segment error boundary (e.g. /login, /auth/*). It also renders inside the
 * root layout, so NextIntlClientProvider is in scope — we use `useTranslations`.
 *
 * Do NOT import the server-only `logError` here (client component); we log to the
 * browser console for client-side visibility only.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
    reportClientError(error, "boundary");
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </div>
  );
}
