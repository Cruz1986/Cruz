import type { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/db/public";
import { searchBible } from "@/lib/content/bible";
import { publicBible, defaultTranslation } from "@/lib/content/public-bible";
import { apiError, json } from "@/lib/api";

/** GET /api/bible/search?q=…&translation=…&after=… — 20 verses per page, keyset paginated. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return apiError(400, "invalid_query", "q must be 2–100 characters.");
  const after = Number(params.get("after") ?? 0);
  if (!Number.isSafeInteger(after) || after < 0)
    return apiError(400, "invalid_cursor", "after must be a cursor from a previous page.");

  const translations = await publicBible.translations();
  const code = params.get("translation");
  const translation = code ? translations.find((t) => t.code === code) : defaultTranslation(translations, "ta");
  const db = createPublicClient();
  if (!translation || !db) return apiError(404, "translation_not_found", "No such published translation.");

  const { hits, nextAfter } = await searchBible(db, translation.code, q, after);
  return json({
    translation: translation.code,
    results: hits.map((h) => ({ book: h.book, chapter: h.chapter, verse: h.verse, label: h.label, text: h.text })),
    next: nextAfter,
  });
}
