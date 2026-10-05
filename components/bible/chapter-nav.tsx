import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";

type Target = { href: string } | null;

export async function ChapterNav({ previous, next, all }: { previous: Target; next: Target; all: string }) {
  const t = await getTranslations("bible");
  return (
    <nav aria-label={t("chapters")} className="flex items-center justify-between gap-2">
      {previous ? (
        <Link href={previous.href} rel="prev" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <ChevronLeft aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{t("previousChapter")}</span>
        </Link>
      ) : (
        <span />
      )}
      <Link href={all} className={buttonClasses({ variant: "ghost", size: "sm" })}>
        <LayoutGrid aria-hidden className="size-4" />
        {t("allChapters")}
      </Link>
      {next ? (
        <Link href={next.href} rel="next" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <span className="sr-only sm:not-sr-only">{t("nextChapter")}</span>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
