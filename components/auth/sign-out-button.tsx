"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { personal } from "@/lib/personal/client";
import { stopPushOnDevice } from "@/lib/notifications/device";
import { Button } from "@/components/ui/button";

export function SignOutButton({ size = "md" }: { size?: "sm" | "md" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const cleaned = useRef(false);
  return (
    // The account's library and reminders stay with the account, not on this (possibly shared) device.
    <form
      action={signOut}
      onSubmit={(e) => {
        if (cleaned.current) return;
        e.preventDefault();
        const form = e.currentTarget;
        personal.forgetDevice();
        void stopPushOnDevice().finally(() => {
          cleaned.current = true;
          form.requestSubmit();
        });
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="secondary" size={size}>
        <LogOut aria-hidden className="size-4" />
        {t("signOut")}
      </Button>
    </form>
  );
}
