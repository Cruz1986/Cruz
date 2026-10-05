import { publicPrayers } from "@/lib/content/prayers";
import { publicBible } from "@/lib/content/public-bible";
import { apiError, json } from "@/lib/api";

/** GET /api/prayers/{slug} — one published prayer with its texts (prayer markup, see lib/prayers/markup.ts). */
export async function GET(_request: Request, ctx: RouteContext<"/api/prayers/[slug]">) {
  const { slug } = await ctx.params;
  const prayer = await publicPrayers.bySlug(slug);
  if (!prayer) return apiError(404, "prayer_not_found", "No such published prayer.");
  return json(
    {
      slug: prayer.slug,
      title: { en: prayer.titleEn, ta: prayer.titleTa },
      text: { en: prayer.bodyEn, ta: prayer.bodyTa },
      attribution: await publicBible.attribution(prayer.sourceId),
    },
    { maxAge: 3600 },
  );
}
