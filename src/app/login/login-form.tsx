"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  sendMagicLink,
  signInWithGoogleAction,
  type SendMagicLinkState,
} from "./actions";

const initialState: SendMagicLinkState = { status: "idle" };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/**
 * The magic-link form. `linkExpired` is resolved by the server page from the
 * `?error=expired` hint that /auth/confirm redirects to after a failed/expired
 * OTP, and shown above the form.
 */
export function LoginForm({ linkExpired = false }: { linkExpired?: boolean }) {
  const t = useTranslations("auth");
  const tLegal = useTranslations("legal");
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );
  const [googlePending, startGoogle] = useTransition();
  const [googleError, setGoogleError] = useState(false);

  function handleGoogle() {
    setGoogleError(false);
    startGoogle(async () => {
      const result = await signInWithGoogleAction();
      if (result.status === "ok") {
        window.location.href = result.url;
        return;
      }
      setGoogleError(true);
    });
  }

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <div className="ql-rise rounded-2xl border border-border bg-card px-6 py-8 shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
      <h1 className="text-3xl font-semibold">{t("signIn")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("signInHint")}</p>

      {state.status !== "sent" ? (
        <div className="mt-7 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googlePending}
            aria-busy={googlePending}
            className="h-11 gap-2.5"
          >
            <GoogleIcon />
            {t("continueWithGoogle")}
          </Button>
          {googleError ? (
            <p role="alert" className="text-sm text-destructive">
              {t("googleError")}
            </p>
          ) : null}

          <div
            className="flex items-center gap-3 text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-border" />
            <span className="uppercase">{t("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}

      {linkExpired && state.status !== "sent" ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-border bg-accent/40 p-3 text-sm"
        >
          {t("linkExpired")}
        </p>
      ) : null}

      {state.status === "sent" ? (
        <p className="mt-6 rounded-lg border border-border bg-accent/40 p-4 text-sm">
          {t("linkSent")}
        </p>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3">
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
            className="h-11 rounded-lg border border-input bg-card px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          {state.status === "error" ? (
            <p className="text-sm text-destructive">{t("error")}</p>
          ) : null}
          <Button type="submit" className="h-11" disabled={pending}>
            {t("sendLink")}
          </Button>
        </form>
      )}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/legal/privacy" className="underline-offset-4 hover:underline">
          {tLegal("privacy")}
        </Link>
        {" · "}
        <Link href="/legal/terms" className="underline-offset-4 hover:underline">
          {tLegal("terms")}
        </Link>
      </p>
    </section>
  );
}
