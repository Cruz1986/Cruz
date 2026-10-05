import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/routing";

/** Public content the sitemap lists (published only; the public client cannot read drafts). */
export type SitemapContent = {
  prayers: string[];
  saints: string[];
  rosarySets: string[];
  bible: { translation: string; books: { code: string; chapters: number[] }[] }[];
};

const SECTIONS = [
  "",
  "/today",
  "/calendar",
  "/bible",
  "/prayers",
  "/rosary",
  "/saints",
  "/credits",
  "/privacy",
  "/more",
];

/** One entry per page, each naming its other-language version (hreflang). */
export function sitemapEntries(siteUrl: string, content: SitemapContent): MetadataRoute.Sitemap {
  const paths = [
    ...SECTIONS,
    ...content.prayers.map((slug) => `/prayers/${slug}`),
    ...content.saints.map((slug) => `/saints/${slug}`),
    ...content.rosarySets.map((key) => `/rosary/${key}`),
    ...content.bible.flatMap(({ translation, books }) => [
      `/bible/${translation}`,
      ...books.flatMap((b) => [
        `/bible/${translation}/${b.code.toLowerCase()}`,
        ...b.chapters.map((c) => `/bible/${translation}/${b.code.toLowerCase()}/${c}`),
      ]),
    ]),
  ];
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`])) },
    })),
  );
}

/**
 * Crawlers may index the reading pages of the production site only. Personal, account, admin and search
 * pages are excluded; preview deployments are not indexed at all.
 */
export function robotsFor(siteUrl: string, production: boolean): MetadataRoute.Robots {
  if (!production) return { rules: { userAgent: "*", disallow: "/" } };
  const personal = ["admin", "library", "settings", "login", "search"].flatMap((p) => locales.map((l) => `/${l}/${p}`));
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...personal] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

/** True on the production deployment (Vercel sets VERCEL_ENV; elsewhere an https site URL counts). */
export function isProductionSite(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return (env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
}
