"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sun, Users, Sparkles, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; key: "today" | "people" | "assistant" | "settings"; icon: LucideIcon }[] = [
  { href: "/", key: "today", icon: Sun },
  { href: "/people", key: "people", icon: Users },
  { href: "/assistant", key: "assistant", icon: Sparkles },
  { href: "/settings", key: "settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("ariaLabel")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-3 text-[0.7rem] font-medium tracking-wide transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-7 rounded-full bg-primary"
                  />
                ) : null}
                <Icon
                  aria-hidden="true"
                  strokeWidth={active ? 2 : 1.5}
                  className="size-5"
                />
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
