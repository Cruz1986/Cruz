import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAs } from "./support/session";

const withData = Boolean(process.env.E2E_DATA);

test.describe("production endpoints", () => {
  test.skip(({ isMobile }) => isMobile, "server responses: one project is enough");

  test("the health check reports the database without revealing configuration", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    expect(response.headers()["cache-control"]).toBe("no-store");
    if (withData) expect([response.status(), body.status, body.database]).toEqual([200, "ok", "ok"]);
    else expect([response.status(), body.database]).toEqual([503, "not_configured"]);
    expect(Object.keys(body).sort()).toEqual(["database", "status", "version"]);
  });

  test("a test or preview server asks search engines not to index it", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/\s*$/);
  });

  test("the sitemap lists the reading pages in both languages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/ta\/today<\/loc>/);
    expect(xml).toMatch(/hreflang="en" href="[^"]+\/en\/today"/);
    expect(xml).not.toMatch(/\/(admin|library|settings|login)</);
    if (withData) {
      expect(xml).toContain(`/en/bible/en-drc/jhn/3</loc>`);
      expect(xml).toContain(`/ta/saints/francis-xavier</loc>`);
      expect(xml).not.toContain("ta-tcb2012");
    }
  });
});

test.describe("privacy and credits", () => {
  test("the privacy page explains what is kept, in both languages", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Without an account" })).toBeVisible();
    await page.goto("/ta/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "தனியுரிமை" })).toBeVisible();
  });

  test("it is reachable from More and from sign-in", async ({ page }) => {
    await page.goto("/en/more");
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/en\/privacy$/);
    test.skip(!withData, "sign-in needs Supabase");
    await page.goto("/en/login");
    await expect(page.getByRole("link", { name: "Privacy" }).last()).toHaveAttribute("href", "/en/privacy");
  });

  test("the credits list every published source with its licence", async ({ page }) => {
    test.skip(!withData, "set E2E_DATA=1");
    await page.goto("/en/credits");
    const texts = page.locator("section", { has: page.getByRole("heading", { name: "Texts" }) });
    await expect(texts.getByText("Douay-Rheims Bible, Challoner revision", { exact: true })).toBeVisible();
    await expect(texts.getByText("Public domain").first()).toBeVisible();
    // Sources whose permission is pending are never listed.
    await expect(page.getByText("திருவிவிலியம்")).toHaveCount(0);
  });
});

const userId = process.env.E2E_USER_ID;
test.describe("deleting an account", () => {
  test.skip(!withData || !process.env.E2E_JWT_SECRET || !userId, "set E2E_JWT_SECRET and E2E_USER_ID");

  test("asks for confirmation first", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, userId!);
    await page.goto("/en/login");
    await page.getByText("Delete my account", { exact: true }).first().click();
    const submit = page.getByRole("button", { name: "Delete my account" });
    await expect(submit).toBeDisabled();
    await page.getByLabel("I understand that this cannot be undone.").check();
    await expect(submit).toBeEnabled();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    // Not submitted: the test reader is shared with other tests.
  });
});
