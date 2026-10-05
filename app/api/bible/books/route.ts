import type { NextRequest } from "next/server";
import { publicBible, defaultTranslation } from "@/lib/content/public-bible";
import { apiError, json } from "@/lib/api";

/** GET /api/bible/books?translation=en-drc — books with their chapters. */
export async function GET(request: NextRequest) {
  const translations = await publicBible.translations();
  const code = request.nextUrl.searchParams.get("translation");
  const translation = code ? translations.find((t) => t.code === code) : defaultTranslation(translations, "ta");
  if (!translation) return apiError(404, "translation_not_found", "No such published translation.");
  const books = await publicBible.books(translation.code);
  return json(
    {
      translation: { code: translation.code, name: translation.name, language: translation.language },
      books: books.map((b) => ({
        code: b.code,
        name: { en: b.nameEn, ta: b.nameTa },
        testament: b.testament,
        chapters: b.chapters,
      })),
    },
    { maxAge: 3600 },
  );
}
