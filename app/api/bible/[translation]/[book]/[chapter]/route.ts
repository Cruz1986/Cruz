import { chapterFromSlugs, publicBible } from "@/lib/content/public-bible";
import { apiError, json } from "@/lib/api";

/** GET /api/bible/{translation}/{book}/{chapter} — verses and headings of one chapter. */
export async function GET(_request: Request, ctx: RouteContext<"/api/bible/[translation]/[book]/[chapter]">) {
  const { translation, book, chapter: chapterSlug } = await ctx.params;
  const chapter = await chapterFromSlugs(translation, book, chapterSlug);
  if (!chapter) return apiError(404, "chapter_not_found", "No such chapter in a published translation.");
  const attribution = await publicBible.attribution(chapter.translation.sourceId);
  return json(
    {
      translation: {
        code: chapter.translation.code,
        name: chapter.translation.name,
        language: chapter.translation.language,
      },
      book: chapter.book.code,
      chapter: chapter.chapter,
      attribution,
      headings: chapter.headings,
      verses: chapter.verses.map((v) => ({
        verse: v.verse,
        label: v.label,
        text: v.text,
        poetry: v.isPoetry,
        canonicalKey: v.key,
      })),
      previous: chapter.previous,
      next: chapter.next,
    },
    { maxAge: 3600 },
  );
}
