import { expect, test } from "@playwright/test";

/**
 * Page-weight budgets for the public pages (compressed JavaScript and fonts loaded before the load event,
 * signed out, cold cache). Next.js prefetches linked pages afterwards, in the background; that is not counted.
 * Raise a budget only deliberately: most readers use phones on mobile data.
 */
const JS_BUDGET_KB = 220;
const FONT_BUDGET_KB = 150;
const PAGES = [
  "/ta",
  "/en/today",
  "/en/bible",
  "/en/prayers",
  "/en/rosary",
  "/en/saints",
  "/en/calendar",
  "/en/library",
];

test.describe("page weight", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "measured with Chromium's network events");

  for (const path of PAGES) {
    test(`${path} stays within budget`, async ({ page, context }) => {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      const types = new Map<string, string>();
      const bytes = { Script: 0, Font: 0 } as Record<string, number>;
      cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
      cdp.on("Network.loadingFinished", (e) => {
        const type = types.get(e.requestId);
        if (type && type in bytes) bytes[type] += e.encodedDataLength;
      });
      await page.goto(path, { waitUntil: "load" });
      expect(Math.round(bytes.Script / 1024), "JavaScript (KB, compressed)").toBeLessThanOrEqual(JS_BUDGET_KB);
      expect(Math.round(bytes.Font / 1024), "fonts (KB)").toBeLessThanOrEqual(FONT_BUDGET_KB);
    });
  }

  test("signed-out pages do not load the account client", async ({ page }) => {
    const scripts: Promise<string>[] = [];
    page.on("response", (r) => {
      if (r.request().resourceType() === "script") scripts.push(r.text().catch(() => ""));
    });
    await page.goto("/en/library", { waitUntil: "load" });
    const loaded = await Promise.all(scripts.splice(0));
    expect(loaded.some((s) => s.includes("GoTrueClient"))).toBe(false);
  });
});
