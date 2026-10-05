"use client";

import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { personal } from "@/lib/personal/client";
import { Button } from "@/components/ui/button";

export function SignOutButton({ size = "md" }: { size?: "sm" | "md" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  return (
    // The account's library stays in the account, not on this (possibly shared) device.
    <form action={signOut} onSubmit={() => personal.forgetDevice()}>
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="secondary" size={size}>
        <LogOut aria-hidden className="size-4" />
        {t("signOut")}
      </Button>
    </form>
  );
}
