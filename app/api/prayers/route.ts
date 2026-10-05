import { publicPrayers } from "@/lib/content/prayers";
import { json } from "@/lib/api";

/** GET /api/prayers — published prayers by category (titles only). */
export async function GET() {
  const [categories, prayers] = await Promise.all([publicPrayers.categories(), publicPrayers.list()]);
  return json(
    {
      categories: categories.map((c) => ({
        slug: c.slug,
        name: { en: c.nameEn, ta: c.nameTa },
        prayers: prayers
          .filter((p) => p.categoryId === c.id)
          .map((p) => ({
            slug: p.slug,
            title: { en: p.titleEn, ta: p.titleTa },
            languages: [p.hasTa && "ta", p.hasEn && "en"].filter(Boolean),
          })),
      })),
    },
    { maxAge: 3600 },
  );
}
