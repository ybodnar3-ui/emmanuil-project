import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { normalizeLocale } from "@/i18n/locale";
import { prisma } from "@/server/db";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Resolve a valid app locale from an optional auth-provided locale.
 * Pure, unit-testable seam — defers to normalizeLocale (falls back to "en").
 */
export function resolveDefaultLocale(authUserLocale?: string | null): string {
  return normalizeLocale(authUserLocale ?? undefined);
}

/**
 * Returns the current Prisma User, mirroring the Supabase auth user.
 * Reads the Supabase session; if none, returns null. If present, upserts a Prisma
 * User row whose id === the Supabase auth UID (stores email + default locale) and
 * returns it.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const email = user.email ?? `${user.id}@no-email.local`;
  const locale = resolveDefaultLocale(
    (user.user_metadata?.locale as string | undefined) ?? null,
  );

  // `update` intentionally omits `locale`: the DB `locale` is a one-time default
  // set at row creation. Runtime locale switching is cookie-based (see src/i18n),
  // so we don't overwrite the stored value from Supabase metadata on every login.
  return prisma.user.upsert({
    where: { id: user.id },
    update: { email },
    create: { id: user.id, email, locale },
  });
}

/**
 * Returns the current Prisma User or redirects to /login if unauthenticated.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
