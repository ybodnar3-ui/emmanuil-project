import { LoginForm } from "./login-form";

/**
 * Login page (server component). Next 16: `searchParams` is a Promise — we await
 * it to read the `?error=expired` hint that /auth/confirm redirects to after a
 * failed/expired magic link, and pass it to the client form.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm linkExpired={error === "expired"} />;
}
