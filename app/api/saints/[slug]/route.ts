import { publicSaints } from "@/lib/content/saints";
import { publicBible } from "@/lib/content/public-bible";
import { saintSummaryJson } from "@/lib/saints/api";
import { apiError, json } from "@/lib/api";

/** GET /api/saints/{slug} — one published saint with biography, image and related prayers. */
export async function GET(_request: Request, ctx: RouteContext<"/api/saints/[slug]">) {
  const { slug } = await ctx.params;
  const saint = await publicSaints.bySlug(slug);
  if (!saint) return apiError(404, "saint_not_found", "No such published saint.");
  return json(
    {
      ...saintSummaryJson(saint),
      born: saint.birthYear,
      died: saint.deathYear,
      biography: { en: saint.biographyEn, ta: saint.biographyTa },
      image: saint.image
        ? {
            url: saint.image.url,
            alt: { en: saint.image.altEn, ta: saint.image.altTa },
            attribution: saint.image.attribution,
          }
        : null,
      prayers: saint.prayers.map((p) => ({ slug: p.slug, title: { en: p.titleEn, ta: p.titleTa } })),
      attribution: await publicBible.attribution(saint.sourceId),
    },
    { maxAge: 3600 },
  );
}
