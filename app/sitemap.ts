import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { publicBible } from "@/lib/content/public-bible";
import { publicPrayers } from "@/lib/content/prayers";
import { publicSaints } from "@/lib/content/saints";
import { publicRosary } from "@/lib/content/rosary";
import { sitemapEntries } from "@/lib/seo";

// Rebuilt daily; new content also appears through each section's own pages in the meantime.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [prayers, saints, rosary, translations] = await Promise.all([
    publicPrayers.list(),
    publicSaints.list(),
    publicRosary(),
    publicBible.translations(),
  ]);
  const bible = await Promise.all(
    translations.map(async (t) => ({
      translation: t.code,
      books: (await publicBible.books(t.code)).map((b) => ({ code: b.code, chapters: b.chapters })),
    })),
  );
  return sitemapEntries(getSiteUrl(), {
    prayers: prayers.map((p) => p.slug),
    saints: saints.filter((s) => s.status === "published").map((s) => s.slug),
    rosarySets: rosary?.sets.map((s) => s.key) ?? [],
    bible,
  });
}
