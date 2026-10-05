import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient } from "@/lib/db/public";
import { buildAliasIndex, parseReference, type BibleReference } from "@/lib/bible/reference";
import { prayerPlainText } from "@/lib/prayers/markup";
import { queryWords, referenceKeys, snippet } from "@/lib/search/snippet";
import { searchBible, type SearchHit, type Translation } from "./bible";
import { defaultTranslation, publicBible } from "./public-bible";
import { DEFAULT_CALENDAR } from "./today";
import { buildSafe } from "./build-safe";

export type ContentKind = "prayer" | "saint" | "mystery" | "reflection" | "celebration";
export type ContentHit = {
  kind: ContentKind;
  key: string;
  titleEn: string | null;
  titleTa: string | null;
  snippet: string | null;
  language: "ta" | "en" | null;
  nextDate: string | null;
  titleMatch: boolean;
};
export type PassageDay = { date: string; titleEn: string; titleTa: string; readingType: string; reference: string };

export type SearchResults = {
  query: string;
  words: string[];
  translation: Translation | null;
  reference: (BibleReference & { href: string }) | null;
  passageDays: PassageDay[];
  verses: SearchHit[];
  moreVerses: boolean;
  content: ContentHit[];
};

const BIBLE_LIMIT = 5;
const PER_KIND = 6;

const contentRow = z.object({
  kind: z.enum(["prayer", "saint", "mystery", "reflection", "celebration"]),
  key: z.string(),
  title_en: z.string().nullable(),
  title_ta: z.string().nullable(),
  body: z.string().nullable(),
  language: z.enum(["ta", "en"]).nullable(),
  next_date: z.string().nullable(),
  title_match: z.boolean(),
});
const dayRow = z.object({
  date: z.string(),
  title_en: z.string(),
  title_ta: z.string(),
  reading_type: z.string(),
  reference: z.string(),
});

const canonOrders = cache(async (): Promise<Map<string, number>> => {
  const db = createPublicClient();
  if (!db) return new Map();
  const { data, error } = await db.from("bible_books").select("code, canon_order");
  if (error) throw new Error(`Failed to load books: ${error.message}`);
  return new Map(
    z
      .array(z.object({ code: z.string(), canon_order: z.number() }))
      .parse(data)
      .map((b) => [b.code, b.canon_order]),
  );
});

/**
 * Site-wide search: a Bible reference (with the upcoming days its passage is read at Mass), matching
 * verses in the reader's translation, and prayers, saints, Rosary mysteries, reflections and
 * celebrations. Only published content is searched.
 */
export async function siteSearch(rawQuery: string, locale: string, today: string): Promise<SearchResults> {
  const query = rawQuery.trim().slice(0, 100);
  const words = queryWords(query);
  const empty: SearchResults = {
    query,
    words,
    translation: null,
    reference: null,
    passageDays: [],
    verses: [],
    moreVerses: false,
    content: [],
  };
  const db = createPublicClient();
  if (!db || !words.length) return empty;

  return buildSafe(async () => {
    const [translations, aliases, orders] = await Promise.all([
      publicBible.translations(),
      publicBible.aliases(),
      canonOrders(),
    ]);
    const translation = defaultTranslation(translations, locale);
    const parsed = parseReference(query, buildAliasIndex(aliases));
    const canon = parsed ? orders.get(parsed.book) : undefined;
    const reference =
      parsed && canon && translation
        ? {
            ...parsed,
            href: `/bible/${translation.code}/${parsed.book.toLowerCase()}/${parsed.chapter}${parsed.verse ? `#v${parsed.verse}` : ""}`,
          }
        : null;

    const [days, verses, content] = await Promise.all([
      reference && canon
        ? db.rpc("days_with_passage", {
            p_start: referenceKeys(canon, reference)[0],
            p_end: referenceKeys(canon, reference)[1],
            p_from: today,
            p_calendar: DEFAULT_CALENDAR,
            p_limit: 6,
          })
        : Promise.resolve({ data: [], error: null }),
      translation && !reference
        ? searchBible(db, translation.code, query)
        : Promise.resolve({ hits: [], nextAfter: null }),
      db.rpc("search_content", { p_query: query, p_from: today, p_calendar: DEFAULT_CALENDAR, p_limit: PER_KIND }),
    ]);
    if (days.error) throw new Error(`Failed to find readings: ${days.error.message}`);
    if (content.error) throw new Error(`Failed to search: ${content.error.message}`);

    return {
      ...empty,
      translation,
      reference,
      passageDays: z
        .array(dayRow)
        .parse(days.data)
        .map((d) => ({
          date: d.date,
          titleEn: d.title_en,
          titleTa: d.title_ta,
          readingType: d.reading_type,
          reference: d.reference,
        })),
      verses: verses.hits.slice(0, BIBLE_LIMIT),
      moreVerses: verses.hits.length > BIBLE_LIMIT,
      content: z
        .array(contentRow)
        .parse(content.data)
        .map((r) => {
          const body = r.body ? (r.kind === "prayer" ? prayerPlainText(r.body) : r.body) : null;
          return {
            kind: r.kind,
            key: r.key,
            titleEn: r.title_en,
            titleTa: r.title_ta,
            snippet: body && !r.title_match ? snippet(body, words) : null,
            language: r.language,
            nextDate: r.next_date,
            titleMatch: r.title_match,
          };
        }),
    };
  }, empty);
}
