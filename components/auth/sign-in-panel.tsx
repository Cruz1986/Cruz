"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { signInWithEmail, signInWithGoogle, type SignInState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initialState: SignInState = { status: "idle" };

export function SignInPanel({ next }: { next: string }) {
  const t = useTranslations("auth");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);

  if (state.status === "sent") {
    return (
      <p role="status" className="bg-accent-soft text-fg rounded-xl p-4">
        {t("sent", { email: state.email })}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-3" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email" className="text-fg block font-medium">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={state.status === "error" && state.error === "invalid_email"}
          aria-describedby={state.status === "error" ? "sign-in-error" : undefined}
          className="border-border bg-surface text-fg block min-h-11 w-full rounded-xl border px-4"
        />
        {state.status === "error" ? (
          <p id="sign-in-error" role="alert" className="text-lit-red text-sm">
            {t(`error.${state.error}`)}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          <Mail aria-hidden className="size-4" />
          {pending ? t("sending") : t("emailSubmit")}
        </Button>
      </form>

      <div className="text-fg-muted flex items-center gap-3 text-sm" aria-hidden>
        <span className="bg-border h-px flex-1" />
        {t("or")}
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">
          {t("google")}
        </Button>
      </form>

      <p className="text-fg-muted text-sm">
        {t("privacy")}{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          {tNav("privacy")}
        </Link>
      </p>
    </div>
  );
}
