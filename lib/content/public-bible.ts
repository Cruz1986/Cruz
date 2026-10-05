import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/db/public";
import * as bible from "./bible";
import { buildSafe } from "./build-safe";
import { bookFromSlug, chapterFromSlug } from "@/lib/bible/paths";

/** Published Bible content, memoised per request (shared by generateMetadata and the page). */
export const publicBible = {
  translations: cache(async () => {
    const db = createPublicClient();
    return db ? buildSafe(() => bible.listTranslations(db), []) : [];
  }),
  books: cache(async (translation: string) => {
    const db = createPublicClient();
    return db ? buildSafe(() => bible.listBooks(db, translation), []) : [];
  }),
  translation: cache(async (code: string) => {
    const db = createPublicClient();
    return db ? bible.getTranslation(db, code) : null;
  }),
  chapter: cache(async (translation: string, book: string, chapter: number) => {
    const db = createPublicClient();
    return db ? bible.getChapter(db, translation, book, chapter) : null;
  }),
  versesByKeys: async (translation: string, keys: number[]) => {
    const db = createPublicClient();
    return db ? bible.getVersesByKeys(db, translation, keys) : new Map<number, bible.Verse[]>();
  },
  attribution: cache(async (sourceId: string) => {
    const db = createPublicClient();
    return db ? bible.getAttribution(db, sourceId) : null;
  }),
  aliases: cache(async () => {
    const db = createPublicClient();
    return db ? bible.listBookAliases(db) : [];
  }),
};

/** The translation to open by default for a UI language. */
export function defaultTranslation(translations: bible.Translation[], locale: string): bible.Translation | null {
  return translations.find((t) => t.language === locale) ?? translations[0] ?? null;
}

/** Resolves URL segments (/bible/<translation>/<book>/<chapter>) to a published chapter. */
export async function chapterFromSlugs(translation: string, bookSlug: string, chapterSlug: string) {
  const book = bookFromSlug(bookSlug);
  const chapter = chapterFromSlug(chapterSlug);
  if (!book || chapter === null) return null;
  return publicBible.chapter(translation, book, chapter);
}

/** Every book with its abbreviations (for formatting references). */
type BookNames = { abbrEn: string; abbrTa: string; nameEn: string; nameTa: string };

export const allBooks = cache(async (): Promise<Map<string, BookNames>> => {
  const db = createPublicClient();
  if (!db) return new Map();
  return buildSafe(async () => {
    const { data, error } = await db.from("bible_books").select("code, abbr_en, abbr_ta, name_en, name_ta");
    if (error) throw new Error(`Failed to load books: ${error.message}`);
    return new Map(
      (data as { code: string; abbr_en: string; abbr_ta: string; name_en: string; name_ta: string }[]).map((b) => [
        b.code,
        { abbrEn: b.abbr_en, abbrTa: b.abbr_ta, nameEn: b.name_en, nameTa: b.name_ta },
      ]),
    );
  }, new Map());
});
