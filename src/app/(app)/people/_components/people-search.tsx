"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { RELATIONSHIP_TIERS } from "@/server/validation/person";

const ALL_TIERS = "all";

/**
 * Client search + tier filter. Writes q/tier/tag into the URL (router.replace,
 * debounced) so the Server Component re-queries. All copy via next-intl.
 */
export function PeopleSearch() {
  const t = useTranslations("people");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const tier = searchParams.get("tier") ?? ALL_TIERS;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: { q?: string; tier?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if ("q" in next) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if ("tier" in next) {
      if (next.tier && next.tier !== ALL_TIERS) params.set("tier", next.tier);
      else params.delete("tier");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  // Debounce search-box edits so we don't navigate on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== query) pushParams({ q: query });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="flex-1"
      />
      <select
        value={tier}
        onChange={(e) => pushParams({ tier: e.target.value })}
        aria-label={t("filterTier")}
        className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
      >
        <option value={ALL_TIERS}>{t("tier.all")}</option>
        {RELATIONSHIP_TIERS.map((value) => (
          <option key={value} value={value}>
            {t(`tier.${value}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
