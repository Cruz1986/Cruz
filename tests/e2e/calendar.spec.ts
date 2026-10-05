import { expect, test } from "@playwright/test";

const withData = Boolean(process.env.E2E_DATA);

test("an invalid month is not found", async ({ request }) => {
  expect((await request.get("/en/calendar/2026-13")).status()).toBe(404);
});

test.describe("calendar without data", () => {
  test.skip(withData, "data is configured");

  test("explains that the calendar is not available yet", async ({ page }) => {
    await page.goto("/en/calendar");
    await expect(page.getByText("The liturgical calendar is not available yet.")).toBeVisible();
  });
});

test.describe("calendar with data", () => {
  test.skip(!withData, "set E2E_DATA=1 with a generated calendar");

  test("shows a month with celebrations and links days to their readings", async ({ page, isMobile }) => {
    await page.goto("/en/calendar/2026-12");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("December 2026");
    const christmas = isMobile
      ? page.getByRole("link", { name: /Nativity of the Lord/ })
      : page.getByRole("link", { name: /25 December: Nativity of the Lord/ });
    await christmas.click();
    await expect(page).toHaveURL(/\/en\/today\/2026-12-25$/);
  });

  test("India's proper solemnity appears on 3 December", async ({ page }) => {
    await page.goto("/en/calendar/2026-12");
    await expect(page.getByText("Saint Francis Xavier, priest").locator("visible=true").first()).toBeVisible();
  });

  test("moves between months across the year boundary", async ({ page }) => {
    await page.goto("/en/calendar/2026-12");
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(/\/en\/calendar\/2027-01$/);
  });

  test("a month that has not been generated says so", async ({ page }) => {
    await page.goto("/en/calendar/2040-01");
    await expect(page.getByText("This month has not been added to the calendar yet.")).toBeVisible();
  });

  test("the API lists every day of the month", async ({ request }) => {
    const body = await (await request.get("/api/calendar?month=2026-04")).json();
    expect(body.days).toHaveLength(30);
    expect(body.days.find((d: { date: string }) => d.date === "2026-04-05").kind).toBe("solemnity");
  });
});
