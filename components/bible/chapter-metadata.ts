import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import type { Chapter } from "@/lib/content/bible";
import { bookName } from "./book-name";

export async function chapterTitle(chapter: Chapter, locale: string): Promise<string> {
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: "bible",
  });
  const name = bookName(chapter.book, locale);
  return chapter.chapter === 0
    ? t("prologueTitle", { book: name })
    : t("chapterTitle", { book: name, chapter: chapter.chapter });
}

export async function chapterMetadata(chapter: Chapter | null, locale: string): Promise<Metadata> {
  if (!chapter) return {};
  return {
    title: `${await chapterTitle(chapter, locale)} · ${chapter.translation.shortName}`,
    description: chapter.verses[0]?.text.replace(/\n/g, " ").slice(0, 160),
  };
}
