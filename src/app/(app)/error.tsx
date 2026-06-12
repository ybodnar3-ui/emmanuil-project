"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the protected (app) route group. It renders INSIDE the root
 * layout, so NextIntlClientProvider is in scope — we use `useTranslations`.
 *
 * The server-only `logError` must NOT be imported here (this is a client
 * component); we log to the browser console via useEffect for client-side
 * visibility. Real server-side logging already happens in the actions/data layer.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </div>
  );
}
