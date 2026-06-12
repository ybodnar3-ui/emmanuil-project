"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type SendMagicLinkState } from "./actions";

const initialState: SendMagicLinkState = { status: "idle" };

/**
 * The magic-link form. `linkExpired` is resolved by the server page from the
 * `?error=expired` hint that /auth/confirm redirects to after a failed/expired
 * OTP, and shown above the form.
 */
export function LoginForm({ linkExpired = false }: { linkExpired?: boolean }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">{t("signIn")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("signInHint")}</p>

      {linkExpired && state.status !== "sent" ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm"
        >
          {t("linkExpired")}
        </p>
      ) : null}

      {state.status === "sent" ? (
        <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm">
          {t("linkSent")}
        </p>
      ) : (
        <form action={formAction} className="mt-6 flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            className="rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.status === "error" ? (
            <p className="text-sm text-destructive">{t("error")}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {t("sendLink")}
          </Button>
        </form>
      )}

      {/* Google OAuth is deferred; an OAuth button would go here, wired to a
          signInWithOAuth server action. */}
    </section>
  );
}
