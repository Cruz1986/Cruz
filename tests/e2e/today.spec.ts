import { expect, test } from "@playwright/test";

/* Today page against real data (calendar generated, lectionary and Douay-Rheims imported). See docs/IMPORT.md. */
const withData = Boolean(process.env.E2E_DATA);

test.describe("Today without data", () => {
  test.skip(withData, "data is configured");

  test("explains that the calendar is not available yet", async ({ page }) => {
    await page.goto("/en/today");
    await expect(page.getByText("The liturgical calendar is not available yet.")).toBeVisible();
  });
});

test.describe("Today with data", () => {
  test.skip(!withData, "set E2E_DATA=1 with a database containing the imports");
  test.use({ timezoneId: "Asia/Kolkata" });

  test("an ordinary weekday shows the weekday cycle readings with text", async ({ page }) => {
    await page.goto("/en/today/2026-10-05");
    await expect(
      page.getByRole("heading", { level: 1, name: "Monday of the 27th Week in Ordinary Time" }),
    ).toBeVisible();
    await expect(page.getByText("Gal 1:6-12")).toBeVisible();
    await expect(page.getByText("Luke 10:25-37")).toBeVisible();
    await expect(page.getByText("a certain lawyer stood up")).toBeVisible();
  });

  test("Christmas has four Masses", async ({ page }) => {
    await page.goto("/en/today/2026-12-25");
    for (const name of ["Vigil Mass", "Mass during the Night", "Mass at Dawn", "Mass during the Day"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
  });

  test("Easter in India is a solemnity with the Easter sequence", async ({ page }) => {
    await page.goto("/en/today/2026-04-05");
    await expect(page.getByText("Solemnity", { exact: true })).toBeVisible();
    await expect(page.getByText("Victimae paschali laudes")).toBeVisible();
  });

  test("day navigation moves by one day", async ({ page }) => {
    await page.goto("/ta/today/2026-10-05");
    await page.getByRole("link", { name: "அடுத்த நாள்" }).click();
    await expect(page).toHaveURL(/\/ta\/today\/2026-10-06$/);
  });

  test("invalid dates are not found", async ({ request }) => {
    expect((await request.get("/en/today/2026-02-30")).status()).toBe(404);
  });

  test("the home page shows today's Gospel reference", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText(/Today's Gospel\s*·\s*\S+/)).toBeVisible();
  });

  test("the API returns the day's readings", async ({ request }) => {
    const body = await (await request.get("/api/today?date=2026-10-05&lang=en")).json();
    expect(body.title.en).toBe("Monday of the 27th Week in Ordinary Time");
    expect(body.masses[0].readings.map((r: { type: string }) => r.type)).toEqual([
      "first",
      "psalm",
      "acclamation",
      "gospel",
    ]);
  });
});
