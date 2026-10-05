import { expect, test } from "@playwright/test";

/*
 * Bible reader against real data. Needs a database with the Douay-Rheims import published
 * (see docs/IMPORT.md) and the app built with NEXT_PUBLIC_SUPABASE_* pointing at it.
 * Enabled with E2E_DATA=1; otherwise only the "no data" behaviour is checked.
 */
const withData = Boolean(process.env.E2E_DATA);

test.describe("without Bible data", () => {
  test.skip(withData, "data is configured");

  test("the Bible page explains that texts are not available yet", async ({ page }) => {
    await page.goto("/en/bible");
    await expect(page.getByText("The Bible is not available yet.")).toBeVisible();
  });
});

test.describe("with Bible data", () => {
  test.skip(!withData, "set E2E_DATA=1 with a database containing the imports");

  test("browse from the book list to a chapter and on to the next", async ({ page }) => {
    await page.goto("/en/bible/en-drc");
    await page.getByRole("link", { name: "John", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/bible\/en-drc\/jhn$/);
    await page.getByRole("link", { name: "Chapter 3", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "John 3" })).toBeVisible();
    await expect(page.locator("#v16")).toContainText("For God so loved the world");
    await page.getByRole("link", { name: "Next chapter" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "John 4" })).toBeVisible();
  });

  test("continue reading appears after reading a chapter", async ({ page }) => {
    await page.goto("/en/bible/en-drc/psa/23");
    await page.goto("/en/bible");
    await expect(page.getByRole("link", { name: /Continue reading/ })).toContainText("Psalms 23");
  });

  test("selecting verses offers copy and share", async ({ page }) => {
    await page.goto("/en/bible/en-drc/jhn/3");
    await page.locator("#v16").click();
    const toolbar = page.getByRole("toolbar");
    await expect(toolbar).toContainText("1 verse selected");
    await expect(toolbar.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
    await toolbar.getByRole("button", { name: "Clear selection" }).click();
    await expect(toolbar).toBeHidden();
  });

  test("word search finds verses and pages through results", async ({ page }) => {
    await page.goto("/en/bible/search?q=lamb&t=en-drc");
    await expect(page.getByRole("list", { name: "Search results" }).getByRole("link").first()).toContainText(/lamb/i);
    await page.getByRole("link", { name: "More results" }).click();
    await expect(page).toHaveURL(/after=\d+/);
  });

  test("a reference search jumps to the verse", async ({ page }) => {
    await page.goto("/en/bible/search?q=John+3%3A16&t=en-drc");
    await page.getByRole("link", { name: /Go to/ }).click();
    await expect(page).toHaveURL(/\/en\/bible\/en-drc\/jhn\/3#v16$/);
  });

  test("unpublished translations are not public", async ({ request }) => {
    expect((await request.get("/en/bible/ta-tcb2012/jhn/3")).status()).toBe(404);
    expect((await request.get("/api/bible/ta-tcb2012/jhn/3")).status()).toBe(404);
  });

  test("the chapter API returns verses with attribution", async ({ request }) => {
    const body = await (await request.get("/api/bible/en-drc/jhn/3")).json();
    expect(body.verses).toHaveLength(36);
    expect(body.attribution).toMatch(/public domain/i);
  });
});
