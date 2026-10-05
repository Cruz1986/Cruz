import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { Translation } from "@/lib/content/bible";
import { cn } from "@/lib/cn";

/** Links to the same place in each translation. No JavaScript needed. */
export async function TranslationPicker({
  translations,
  current,
  hrefFor,
}: {
  translations: Translation[];
  current: string;
  hrefFor: (code: string) => string;
}) {
  const t = await getTranslations("bible");
  if (translations.length < 2) return null;
  return (
    <nav aria-label={t("translation")} className="flex flex-wrap gap-2">
      {translations.map((tr) => (
        <Link
          key={tr.code}
          href={hrefFor(tr.code)}
          lang={tr.language}
          aria-current={tr.code === current ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
            tr.code === current
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-fg hover:bg-surface-muted",
          )}
        >
          {tr.shortName}
        </Link>
      ))}
    </nav>
  );
}
