import "server-only";
import { z } from "zod";
import type { DbClient } from "@/lib/db/public";

/*
 * Bible data access. Every function takes the client to use: the anonymous public client
 * for reader pages (published content only), or a signed-in client for staff previews.
 * Row level security decides what each one can see.
 */

const translationSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  short_name: z.string(),
  language: z.enum(["ta", "en"]),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  source_id: z.string(),
});
export type Translation = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  language: "ta" | "en";
  status: z.infer<typeof translationSchema>["status"];
  sourceId: string;
};

const bookSchema = z.object({
  code: z.string(),
  canon_order: z.number(),
  testament: z.enum(["old", "new"]),
  is_deuterocanonical: z.boolean(),
  is_supplement: z.boolean(),
  name_en: z.string(),
  name_ta: z.string(),
  abbr_en: z.string(),
  abbr_ta: z.string(),
});
export type Book = {
  code: string;
  testament: "old" | "new";
  isDeuterocanonical: boolean;
  isSupplement: boolean;
  nameEn: string;
  nameTa: string;
  abbrEn: string;
  abbrTa: string;
};
export type TranslationBook = Book & { order: number; chapters: number[] };

const verseSchema = z.object({
  id: z.string(),
  verse: z.number(),
  verse_part: z.string(),
  verse_label: z.string().nullable(),
  text: z.string(),
  is_poetry: z.boolean(),
  paragraph_end: z.boolean(),
  canonical_vkey: z.number().nullable(),
});
export type Verse = {
  id: string;
  verse: number;
  label: string;
  text: string;
  isPoetry: boolean;
  paragraphEnd: boolean;
  key: number | null;
};

const headingSchema = z.object({ before_verse: z.number(), level: z.number(), text: z.string() });
export type Heading = { beforeVerse: number; level: number; text: string };

export type Chapter = {
  translation: Translation;
  book: TranslationBook;
  chapter: number;
  verses: Verse[];
  headings: Heading[];
  previous: { book: string; chapter: number } | null;
  next: { book: string; chapter: number } | null;
};

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Failed to load ${what}: ${result.error.message}`);
  return result.data as T;
}

function toTranslation(row: z.infer<typeof translationSchema>): Translation {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    shortName: row.short_name,
    language: row.language,
    status: row.status,
    sourceId: row.source_id,
  };
}

function toBook(row: z.infer<typeof bookSchema>): Book {
  return {
    code: row.code,
    testament: row.testament,
    isDeuterocanonical: row.is_deuterocanonical,
    isSupplement: row.is_supplement,
    nameEn: row.name_en,
    nameTa: row.name_ta,
    abbrEn: row.abbr_en,
    abbrTa: row.abbr_ta,
  };
}

const TRANSLATION_COLUMNS = "id, code, name, short_name, language, status, source_id";

export async function listTranslations(db: DbClient): Promise<Translation[]> {
  const rows = check(
    await db
      .from("bible_translations")
      .select(TRANSLATION_COLUMNS)
      .order("sort_order")
      .order("language", { ascending: false }),
    "translations",
  );
  return z.array(translationSchema).parse(rows).map(toTranslation);
}

export async function getTranslation(db: DbClient, code: string): Promise<Translation | null> {
  const row = check(
    await db.from("bible_translations").select(TRANSLATION_COLUMNS).eq("code", code).maybeSingle(),
    "translation",
  );
  return row ? toTranslation(translationSchema.parse(row)) : null;
}

/** Books printed in a translation, in its own order, with the chapters it contains. */
export async function listBooks(db: DbClient, translationCode: string): Promise<TranslationBook[]> {
  const [chapterRows, bookRows] = await Promise.all([
    db.rpc("bible_book_chapters", { p_translation: translationCode }),
    db
      .from("bible_books")
      .select("code, canon_order, testament, is_deuterocanonical, is_supplement, name_en, name_ta, abbr_en, abbr_ta"),
  ]);
  const chapters = z
    .array(z.object({ book_code: z.string(), sort_order: z.number(), chapters: z.array(z.number()) }))
    .parse(check(chapterRows, "chapters"));
  const books = new Map(
    z
      .array(bookSchema)
      .parse(check(bookRows, "books"))
      .map((b) => [b.code, toBook(b)]),
  );
  return chapters.flatMap((c) => {
    const book = books.get(c.book_code);
    return book ? [{ ...book, order: c.sort_order, chapters: c.chapters }] : [];
  });
}

function neighbour(books: TranslationBook[], bookIndex: number, chapter: number, step: 1 | -1) {
  const book = books[bookIndex];
  const position = book.chapters.indexOf(chapter) + step;
  if (position >= 0 && position < book.chapters.length) return { book: book.code, chapter: book.chapters[position] };
  const other = books[bookIndex + step];
  if (!other) return null;
  return { book: other.code, chapter: step === 1 ? other.chapters[0] : other.chapters.at(-1)! };
}

export async function getChapter(
  db: DbClient,
  translationCode: string,
  bookCode: string,
  chapter: number,
): Promise<Chapter | null> {
  const translation = await getTranslation(db, translationCode);
  if (!translation) return null;
  const books = await listBooks(db, translationCode);
  const bookIndex = books.findIndex((b) => b.code === bookCode);
  const book = books[bookIndex];
  if (!book || !book.chapters.includes(chapter)) return null;

  const { data: bookRow } = await db.from("bible_books").select("id").eq("code", bookCode).single();
  if (!bookRow) return null;

  const [verseRows, headingRows] = await Promise.all([
    db
      .from("bible_verses")
      .select("id, verse, verse_part, verse_label, text, is_poetry, paragraph_end, canonical_vkey")
      .eq("translation_id", translation.id)
      .eq("book_id", bookRow.id)
      .eq("chapter", chapter)
      .order("ordinal"),
    db
      .from("bible_section_headings")
      .select("before_verse, level, text")
      .eq("translation_id", translation.id)
      .eq("book_id", bookRow.id)
      .eq("chapter", chapter)
      .order("before_verse")
      .order("sort_order"),
  ]);

  const verses = z
    .array(verseSchema)
    .parse(check(verseRows, "verses"))
    .map((v) => ({
      id: v.id,
      verse: v.verse,
      label: v.verse_label ?? `${v.verse}${v.verse_part}`,
      text: v.text,
      isPoetry: v.is_poetry,
      paragraphEnd: v.paragraph_end,
      key: v.canonical_vkey,
    }));
  const headings = z
    .array(headingSchema)
    .parse(check(headingRows, "headings"))
    .map((h) => ({ beforeVerse: h.before_verse, level: h.level, text: h.text }));

  return {
    translation,
    book,
    chapter,
    verses,
    headings,
    previous: neighbour(books, bookIndex, chapter, -1),
    next: neighbour(books, bookIndex, chapter, 1),
  };
}

/** Verses of `translationCode` at the given canonical keys (for the parallel view). */
export async function getVersesByKeys(
  db: DbClient,
  translationCode: string,
  keys: number[],
): Promise<Map<number, Verse[]>> {
  const translation = await getTranslation(db, translationCode);
  const result = new Map<number, Verse[]>();
  if (!translation || keys.length === 0) return result;
  const rows = check(
    await db
      .from("bible_verses")
      .select("id, verse, verse_part, verse_label, text, is_poetry, paragraph_end, canonical_vkey")
      .eq("translation_id", translation.id)
      .in("canonical_vkey", [...new Set(keys)])
      .order("canonical_vkey")
      .order("ordinal"),
    "parallel verses",
  );
  for (const v of z.array(verseSchema).parse(rows)) {
    const verse = {
      id: v.id,
      verse: v.verse,
      label: v.verse_label ?? `${v.verse}${v.verse_part}`,
      text: v.text,
      isPoetry: v.is_poetry,
      paragraphEnd: v.paragraph_end,
      key: v.canonical_vkey,
    };
    if (verse.key !== null) result.set(verse.key, [...(result.get(verse.key) ?? []), verse]);
  }
  return result;
}

export async function listBookAliases(db: DbClient): Promise<{ alias: string; code: string }[]> {
  const rows = check(await db.from("bible_book_names").select("alias, bible_books(code)"), "book names");
  return z
    .array(z.object({ alias: z.string(), bible_books: z.object({ code: z.string() }) }))
    .parse(rows)
    .map((r) => ({ alias: r.alias, code: r.bible_books.code }));
}

const searchRowSchema = z.object({
  book_code: z.string(),
  chapter: z.number(),
  verse: z.number(),
  verse_label: z.string().nullable(),
  text: z.string(),
  sort_key: z.number(),
});
export type SearchHit = { book: string; chapter: number; verse: number; label: string; text: string; sortKey: number };

export const SEARCH_PAGE_SIZE = 20;

export async function searchBible(
  db: DbClient,
  translationCode: string,
  query: string,
  after = 0,
): Promise<{ hits: SearchHit[]; nextAfter: number | null }> {
  const rows = check(
    await db.rpc("search_bible", {
      p_translation: translationCode,
      p_query: query,
      p_limit: SEARCH_PAGE_SIZE + 1,
      p_after: after,
    }),
    "search results",
  );
  const hits = z
    .array(searchRowSchema)
    .parse(rows)
    .map((r) => ({
      book: r.book_code,
      chapter: r.chapter,
      verse: r.verse,
      label: r.verse_label ?? String(r.verse),
      text: r.text,
      sortKey: r.sort_key,
    }));
  const more = hits.length > SEARCH_PAGE_SIZE;
  const page = hits.slice(0, SEARCH_PAGE_SIZE);
  return { hits: page, nextAfter: more ? page.at(-1)!.sortKey : null };
}

/** Attribution for a translation's source, if the source is public (verified). */
export async function getAttribution(db: DbClient, sourceId: string): Promise<string | null> {
  const { data } = await db.from("credits").select("name, attribution_text").eq("id", sourceId).maybeSingle();
  return data ? (data.attribution_text ?? data.name) : null;
}
