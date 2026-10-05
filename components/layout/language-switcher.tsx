"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("language");
  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      aria-label={t("switchTo", { language: t(other) })}
      className="border-border text-fg hover:bg-surface-muted inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium"
    >
      <Languages aria-hidden className="size-4" />
      {t(other)}
    </Link>
  );
}
