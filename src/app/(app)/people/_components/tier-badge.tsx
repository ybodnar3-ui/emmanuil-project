import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Relationship-tier pill in the Quiet Luxury palette. VIP reads as bronze on a
 * warm tint (the single accent); friend/acquaintance stay graphite on a neutral
 * warm tint. Presentation only — the `tier`/`label` come from the data layer +
 * next-intl, this just maps a tier to its tasteful styling.
 */
export function TierBadge({
  tier,
  label,
  className,
}: {
  tier: string;
  label: string;
  className?: string;
}) {
  const isVip = tier === "vip";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 border-transparent",
        isVip
          ? "bg-[#efe7d6] text-primary dark:bg-[#2f2a1b] dark:text-primary"
          : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
