import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ size = "md" }: { size?: "sm" | "md" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="secondary" size={size}>
        <LogOut aria-hidden className="size-4" />
        {t("signOut")}
      </Button>
    </form>
  );
}
