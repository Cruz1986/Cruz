import type { NextRequest } from "next/server";
import { siteSearch } from "@/lib/content/search";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { apiError, json, limitSearch } from "@/lib/api";

/**
 * GET /api/search?q=&lang=ta — a Bible reference (with upcoming days its passage is read at Mass),
 * matching verses, prayers, saints, Rosary mysteries, reflections and celebrations.
 */
export async function GET(request: NextRequest) {
  const limited = limitSearch(request);
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2) return apiError(400, "query_too_short", "q must have at least 2 characters.");
  if (q.length > 100) return apiError(400, "query_too_long", "q must have at most 100 characters.");
  const lang = params.get("lang") === "en" ? "en" : "ta";
  const r = await siteSearch(q, lang, toIso(todayIn(DEFAULT_TIME_ZONE)));
  return json(
    {
      query: r.query,
      translation: r.translation?.code ?? null,
      reference: r.reference
        ? {
            book: r.reference.book,
            chapter: r.reference.chapter,
            verse: r.reference.verse,
            verseEnd: r.reference.verseEnd,
            path: r.reference.href,
          }
        : null,
      readAtMass: r.passageDays.map((d) => ({
        date: d.date,
        title: { en: d.titleEn, ta: d.titleTa },
        reading: d.readingType,
        reference: d.reference,
      })),
      verses: r.verses.map((v) => ({ book: v.book, chapter: v.chapter, verse: v.verse, label: v.label, text: v.text })),
      moreVerses: r.moreVerses,
      results: r.content.map((c) => ({
        kind: c.kind,
        key: c.key,
        title: { en: c.titleEn, ta: c.titleTa },
        snippet: c.snippet,
        language: c.language,
        nextDate: c.nextDate,
      })),
    },
    { maxAge: 300 },
  );
}
