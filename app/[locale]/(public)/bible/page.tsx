import { getTranslations } from "next-intl/server";
import { BookOpen, Search } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { defaultTranslation, publicBible } from "@/lib/content/public-bible";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { BookList } from "@/components/bible/book-list";
import { TranslationPicker } from "@/components/bible/translation-picker";
import { ContinueReading } from "@/components/bible/reading-position";

export const revalidate = 3600;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "bible");
}

export default async function BibleHomePage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations();
  const translations = await publicBible.translations();
  const current = defaultTranslation(translations, locale);
  const books = current ? await publicBible.books(current.code) : [];
  const tamilMissing = locale === "ta" && !translations.some((tr) => tr.language === "ta");

  return (
    <>
      <PageHeader title={t("pages.bible.title")} description={t("pages.bible.description")}>
        {current ? (
          <Link href="/bible/search" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Search aria-hidden className="size-4" />
            {t("bible.search")}
          </Link>
        ) : null}
      </PageHeader>

      {!current ? (
        <EmptyState icon={BookOpen} title={t("bible.unavailable")} body={t("bible.unavailableBody")} />
      ) : (
        <div className="space-y-6">
          {tamilMissing ? (
            <p className="bg-surface-muted text-fg-muted rounded-xl p-3 text-sm">{t("bible.tamilPending")}</p>
          ) : null}
          <ContinueReading />
          <TranslationPicker translations={translations} current={current.code} hrefFor={(code) => `/bible/${code}`} />
          <BookList translation={current.code} books={books} />
        </div>
      )}
    </>
  );
}
