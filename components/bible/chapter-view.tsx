import { getLocale, getTranslations } from "next-intl/server";
import { Columns2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { Chapter, Translation, Verse } from "@/lib/content/bible";
import { buttonClasses } from "@/components/ui/button";
import { ChapterNav } from "./chapter-nav";
import { ChapterText } from "./chapter-text";
import { ParallelText } from "./parallel-text";
import { ReadingSize } from "./reading-size";
import { RememberPosition } from "./reading-position";
import { TranslationPicker } from "./translation-picker";
import { VerseSelection } from "./verse-selection";
import { bookAbbr } from "./book-name";
import { chapterTitle } from "./chapter-metadata";

export type ChapterPaths = {
  chapter: (translation: string, book: string, chapter: number) => string;
  book: (translation: string, book: string) => string;
  parallel: (translation: string, book: string, chapter: number, other: string) => string;
};

/**
 * The full reader for one chapter, optionally side by side with another translation.
 * Shared by public pages (anonymous client) and the staff preview (signed-in client).
 */
export async function ChapterView({
  chapter,
  translations,
  paths,
  compare,
  attribution,
  remember = true,
}: {
  chapter: Chapter;
  translations: Translation[];
  paths: ChapterPaths;
  compare?: { translation: Translation; verses: Map<number, Verse[]> } | null;
  attribution: string | null;
  remember?: boolean;
}) {
  const t = await getTranslations("bible");
  const locale = await getLocale();
  const { translation, book } = chapter;
  const title = await chapterTitle(chapter, locale);
  const reference = `${bookAbbr(book, locale)} ${chapter.chapter}`;
  const other = translations.find((tr) => tr.code !== translation.code);

  const nav = (
    <ChapterNav
      previous={chapter.previous ? { href: hrefFor(chapter.previous) } : null}
      next={chapter.next ? { href: hrefFor(chapter.next) } : null}
      all={paths.book(translation.code, book.code)}
    />
  );
  function hrefFor(target: { book: string; chapter: number }) {
    return compare
      ? paths.parallel(translation.code, target.book, target.chapter, compare.translation.code)
      : paths.chapter(translation.code, target.book, target.chapter);
  }

  return (
    <article className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-fg text-2xl font-bold sm:text-3xl">{title}</h1>
          <div className="flex items-center gap-2">
            <ReadingSize />
            {other ? (
              compare ? (
                <Link
                  href={paths.chapter(translation.code, book.code, chapter.chapter)}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  {t("singleView")}
                </Link>
              ) : (
                <Link
                  href={paths.parallel(translation.code, book.code, chapter.chapter, other.code)}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  <Columns2 aria-hidden className="size-4" />
                  <span className="sm:hidden">{t("compare")}</span>
                  <span className="hidden sm:inline">{t("compareWith", { name: other.shortName })}</span>
                </Link>
              )
            ) : null}
          </div>
        </div>
        <TranslationPicker
          translations={translations}
          current={translation.code}
          hrefFor={(code) => paths.chapter(code, book.code, chapter.chapter)}
        />
        {nav}
      </header>

      {compare ? (
        <ParallelText chapter={chapter} other={compare.translation} otherVerses={compare.verses} />
      ) : (
        <VerseSelection reference={reference}>
          <ChapterText verses={chapter.verses} headings={chapter.headings} language={translation.language} />
        </VerseSelection>
      )}

      <footer className="border-border space-y-4 border-t pt-4">
        {nav}
        <p className="text-fg-muted text-sm">
          {translation.name}
          {attribution ? ` · ${t("source", { attribution })}` : null}
        </p>
      </footer>
      {remember ? (
        <RememberPosition
          translation={translation.code}
          book={book.code}
          chapter={chapter.chapter}
          title={`${title} · ${translation.shortName}`}
        />
      ) : null}
    </article>
  );
}
