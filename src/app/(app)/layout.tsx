import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/server/auth";

/**
 * Protected app shell. Calls requireUser() before rendering — unauthenticated
 * visitors are redirected to /login. Wraps the authenticated tab pages and the
 * bottom navigation. Public routes (/login, /auth/*) live outside this group and
 * render without the nav.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-24 pt-6">{children}</main>
      <BottomNav />
    </>
  );
}
