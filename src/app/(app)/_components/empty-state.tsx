import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Shared empty-state card (Quiet Luxury). Drives the app's "light" onboarding:
 * a Playfair title, an optional muted description, an optional primary CTA, and
 * an optional secondary link. Purely presentational — callers pass already-
 * localized strings.
 */
export function EmptyState({
  title,
  description,
  action,
  secondary,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <p className="font-heading text-xl text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5">
          <Button
            render={<Link href={action.href} />}
            nativeButton={false}
            size="sm"
          >
            {action.label}
          </Button>
        </div>
      ) : null}
      {secondary ? (
        <Link
          href={secondary.href}
          className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          {secondary.label}
        </Link>
      ) : null}
    </div>
  );
}
