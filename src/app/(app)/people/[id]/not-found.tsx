import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/**
 * Rendered when `notFound()` is called for a person (stale/deleted id, or a
 * person owned by someone else). Server component, so we can resolve copy with
 * `getTranslations`.
 */
export default async function PersonNotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
      <Button nativeButton={false} render={<Link href="/people" />}>
        {t("backToPeople")}
      </Button>
    </div>
  );
}
