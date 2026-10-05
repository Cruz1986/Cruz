import { expect, test } from "@playwright/test";

const withData = Boolean(process.env.E2E_DATA);

test.describe("saints without data", () => {
  test.skip(withData, "data is configured");

  test("explains that saints are not available yet", async ({ page }) => {
    await page.goto("/en/saints");
    await expect(page.getByRole("heading", { level: 1, name: "Saints" })).toBeVisible();
    await expect(page.getByText("Saints are not available yet.")).toBeVisible();
  });
});

test.describe("saints with data", () => {
  test.skip(!withData, "set E2E_DATA=1 with imported saints and calendar");

  test("shows the saint of the day and every saint by month", async ({ page }) => {
    await page.goto("/en/saints");
    await expect(page.getByRole("heading", { level: 2, name: /Saints? of the Day/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "December" })).toBeAttached();
    await expect(page.getByRole("link", { name: /Saint Francis Xavier/ })).toBeAttached();
  });

  test("search finds saints by name, title and patronage", async ({ page }) => {
    await page.goto("/en/saints");
    const search = page.getByLabel("Search saints");
    await search.fill("xavier");
    await expect(page.getByRole("link", { name: /Saint Francis Xavier/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Saint Agnes/ })).toBeHidden();
    await search.fill("India");
    await expect(page.getByRole("link", { name: /Saint Thomas\b/ }).first()).toBeVisible();
    await search.fill("zzzz");
    await expect(page.getByText("No saints match “zzzz”.")).toBeVisible();
  });

  test("a profile shows the feast, life, source and the day's readings", async ({ page }) => {
    await page.goto("/en/saints/francis-xavier");
    await expect(page.getByRole("heading", { level: 1, name: "Saint Francis Xavier" })).toBeVisible();
    await expect(page.getByText("Feast: 3 December")).toBeVisible();
    await expect(page.getByText("1506–1552")).toBeVisible();
    await expect(page.getByText(/Original text written for this app/)).toBeVisible();
    await page.getByRole("link", { name: "Readings for 3 December" }).click();
    await expect(page).toHaveURL(/\/en\/today\/\d{4}-12-03$/);
    await page.getByRole("link", { name: "About this saint" }).click();
    await expect(page).toHaveURL(/\/en\/saints\/francis-xavier$/);
  });

  test("related prayers are linked", async ({ page }) => {
    await page.goto("/en/saints/archangels");
    await page.getByRole("link", { name: /Saint Michael/ }).click();
    await expect(page).toHaveURL(/\/en\/prayers\/saint-michael$/);
  });

  test("the Tamil profile says when the Tamil biography is not ready", async ({ page }) => {
    await page.goto("/ta/saints/devasahayam-pillai");
    await expect(page.getByRole("heading", { level: 1, name: "புனித தேவசகாயம் பிள்ளை" })).toBeVisible();
    await expect(page.getByText("தமிழ் வாழ்க்கை வரலாறு தயாராகிறது")).toBeVisible();
  });

  test("unknown saints are not found", async ({ page }) => {
    const response = await page.goto("/en/saints/no-such-saint");
    expect(response?.status()).toBe(404);
  });

  test("the API returns saints of a date, a profile and search results", async ({ request }) => {
    const day = await (await request.get("/api/saints/today?date=2026-06-29")).json();
    expect(day.saints.map((s: { slug: string }) => s.slug)).toEqual(expect.arrayContaining(["peter", "paul"]));
    const saint = await (await request.get("/api/saints/thomas")).json();
    expect(saint.feast).toBe("07-03");
    expect(saint.biography.en).toContain("India");
    const search = await (await request.get("/api/saints/search?q=தோமா")).json();
    expect(search.results.map((s: { slug: string }) => s.slug)).toEqual(
      expect.arrayContaining(["thomas", "thomas-aquinas"]),
    );
    expect((await request.get("/api/saints/search?q=x")).status()).toBe(400);
  });

  test("the saints admin requires signing in", async ({ page }) => {
    await page.goto("/en/admin/saints");
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  });
});
