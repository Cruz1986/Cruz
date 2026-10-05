"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteAccount, type DeleteAccountState } from "@/lib/auth/actions";
import { stopPushOnDevice } from "@/lib/notifications/device";
import { Button } from "@/components/ui/button";

const initialState: DeleteAccountState = { status: "idle" };

/**
 * Deletes the reader's account after they confirm. This device's push subscription is stopped first; the device copy
 * of their library is cleared on the next page load, as after signing out.
 */
export function DeleteAccount() {
  const t = useTranslations("auth.delete");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <details className="border-border rounded-xl border p-4">
      <summary className="cursor-pointer font-medium">{t("title")}</summary>
      <form
        action={async (formData) => {
          await stopPushOnDevice();
          formAction(formData);
        }}
        className="mt-3 space-y-3"
      >
        <p className="text-fg-muted text-sm">{t("body")}</p>
        <input type="hidden" name="locale" value={locale} />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="confirm"
            value="yes"
            className="mt-1 size-5"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t("confirm")}
        </label>
        <Button type="submit" variant="secondary" className="text-lit-red" disabled={!confirmed || pending}>
          <Trash2 aria-hidden className="size-4" />
          {pending ? t("deleting") : t("submit")}
        </Button>
        {state.status === "error" ? (
          <p role="alert" className="text-lit-red text-sm">
            {t(`error.${state.error}`)}
          </p>
        ) : null}
      </form>
    </details>
  );
}
