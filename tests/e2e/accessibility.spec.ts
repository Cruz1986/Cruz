import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const withData = Boolean(process.env.E2E_DATA);

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

const PAGES = [
  "/ta",
  "/en",
  "/ta/settings",
  "/en/more",
  "/ta/login",
  "/en/bible",
  "/en/library",
  "/ta/saints",
  "/en/search?q=thomas",
  "/ta/privacy",
];
const DATA_PAGES = [
  "/en/credits",
  "/ta/today",
  "/en/today/2026-12-03",
  "/ta/calendar",
  "/en/bible/en-drc/jhn/3",
  "/ta/prayers",
  "/en/prayers/angelus",
  "/en/rosary",
  "/ta/rosary/sorrowful",
  "/en/saints/francis-xavier",
  "/ta/search?q=மரியா",
];

for (const path of PAGES) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await violations(page)).toEqual([]);
  });
}

test.describe("pages with content", () => {
  test.skip(!withData, "set E2E_DATA=1");
  for (const path of DATA_PAGES) {
    test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(await violations(page)).toEqual([]);
    });
  }

  test("the verse toolbar, highlight colours and note dialog are accessible", async ({ page }) => {
    await page.goto("/en/bible/en-drc/jhn/3");
    await page.locator("#v16").click();
    await page.getByRole("button", { name: "Highlight" }).click();
    expect(await violations(page)).toEqual([]);
    await page.getByRole("button", { name: "Note" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the Rosary guide can be prayed with the keyboard alone", async ({ page }) => {
    await page.goto("/en/rosary/joyful");
    await expect(page.getByRole("heading", { name: "Sign of the Cross" })).toBeVisible();
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { name: "The Annunciation" })).toBeVisible();
    // Focus follows the prayer, so screen readers hear each step.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { name: "Our Father" })).toBeFocused();
    expect(await violations(page)).toEqual([]);
  });
});

const staffId = process.env.E2E_STAFF_ID;
test.describe("admin pages", () => {
  test.skip(!withData || !process.env.E2E_JWT_SECRET || !staffId, "set E2E_JWT_SECRET and E2E_STAFF_ID");
  test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, staffId!));
  for (const path of [
    "/en/admin",
    "/en/admin/calendar?date=2026-12-03",
    "/ta/admin/reflections/new",
    "/en/admin/saints",
    "/en/admin/sources",
    "/en/admin/audit",
    "/en/admin/media/new",
    "/en/admin/notifications/new",
  ]) {
    test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(await violations(page)).toEqual([]);
    });
  }
});

test("dark theme has no contrast violations", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/ta");
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("dark theme Bible highlights keep text readable", async ({ page }) => {
  test.skip(!withData, "set E2E_DATA=1");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/bible/en-drc/jhn/3");
  await page.evaluate(() => {
    const colors = ["yellow", "green", "blue", "pink", "purple"];
    document.querySelectorAll<HTMLElement>("[data-verse]").forEach((el, i) => (el.dataset.highlight = colors[i % 5]));
  });
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
