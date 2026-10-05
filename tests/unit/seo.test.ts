import { describe, expect, it } from "vitest";
import { isProductionSite, robotsFor, sitemapEntries } from "@/lib/seo";

const SITE = "https://bible.example.org";

describe("sitemap", () => {
  const entries = sitemapEntries(SITE, {
    prayers: ["angelus"],
    saints: ["francis-xavier"],
    rosarySets: ["joyful"],
    bible: [{ translation: "en-drc", books: [{ code: "JHN", chapters: [1, 2] }] }],
  });
  const urls = entries.map((e) => e.url);

  it("lists every page in both languages", () => {
    expect(urls).toContain(`${SITE}/ta`);
    expect(urls).toContain(`${SITE}/en/today`);
    expect(urls).toContain(`${SITE}/ta/prayers/angelus`);
    expect(urls).toContain(`${SITE}/en/saints/francis-xavier`);
    expect(urls).toContain(`${SITE}/ta/rosary/joyful`);
    expect(urls).toContain(`${SITE}/en/bible/en-drc/jhn`);
    expect(urls).toContain(`${SITE}/ta/bible/en-drc/jhn/2`);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("links each page to its other-language version", () => {
    const page = entries.find((e) => e.url === `${SITE}/en/prayers/angelus`);
    expect(page?.alternates?.languages).toEqual({
      ta: `${SITE}/ta/prayers/angelus`,
      en: `${SITE}/en/prayers/angelus`,
    });
  });

  it("leaves out personal and admin pages", () => {
    expect(urls.some((u) => /\/(admin|library|settings|login|search)/.test(u))).toBe(false);
  });
});

describe("robots", () => {
  it("lets crawlers read the production site but not personal pages or the API", () => {
    const robots = robotsFor(SITE, true);
    const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/api/", "/ta/admin", "/en/library", "/ta/settings"]));
    expect(robots.sitemap).toBe(`${SITE}/sitemap.xml`);
  });

  it("keeps preview deployments out of search engines", () => {
    expect(robotsFor(SITE, false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("knows which deployment is production", () => {
    expect(isProductionSite({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionSite({ VERCEL_ENV: "preview", NEXT_PUBLIC_SITE_URL: SITE })).toBe(false);
    expect(isProductionSite({ NEXT_PUBLIC_SITE_URL: SITE })).toBe(true);
    expect(isProductionSite({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(false);
  });
});
