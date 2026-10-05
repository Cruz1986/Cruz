import { expect, test } from "@playwright/test";

const withData = Boolean(process.env.E2E_DATA);

test("pages send security headers", async ({ request }) => {
  const response = await request.get("/en");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

const PAGES = withData
  ? [
      "/ta",
      "/en/today",
      "/en/bible/en-drc/jhn/3",
      "/en/prayers/memorare",
      "/en/rosary/joyful",
      "/en/saints/thomas",
      "/en/search?q=mary",
      "/en/library",
      "/en/settings",
      "/en/login",
    ]
  : ["/ta", "/en/today", "/en/settings", "/en/login"];

test("pages work within the content security policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });
  for (const path of PAGES) await page.goto(path, { waitUntil: "networkidle" });
  expect(violations).toEqual([]);
});

test("sign-in never sends readers to another site afterwards", async ({ page }) => {
  for (const next of ["https://evil.example/", "//evil.example", "/\\evil.example"]) {
    await page.goto(`/en/login?next=${encodeURIComponent(next)}`);
    const values = await page
      .locator('input[name="next"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    for (const value of values) expect(value).toMatch(/^\/(?![/\\])/);
  }
});

test("APIs reject oversized input", async ({ request }) => {
  expect((await request.get(`/api/search?q=${"a".repeat(101)}`)).status()).toBe(400);
  expect((await request.get(`/api/saints/search?q=${"a".repeat(101)}`)).status()).toBe(400);
});
