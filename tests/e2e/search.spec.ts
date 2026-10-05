import { expect, test } from "@playwright/test";

const withData = Boolean(process.env.E2E_DATA);

test("the search page explains what it searches and opens from the header", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Search" }).first().click();
  await expect(page).toHaveURL(/\/en\/search$/);
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
  await expect(page.getByText(/Try a name/)).toBeVisible();
});

test("the API rejects queries that are too short", async ({ request }) => {
  expect((await request.get("/api/search?q=a")).status()).toBe(400);
});

test.describe("search with data", () => {
  test.skip(!withData, "set E2E_DATA=1 with imported content");

  test("a reference opens the passage and lists the Masses where it is read", async ({ page }) => {
    await page.goto("/en/search");
    await page.getByRole("searchbox").fill("jn 3:16");
    await page.getByRole("searchbox").press("Enter");
    await expect(page.getByRole("link", { name: "Open John 3:16" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Read at Mass" })).toBeVisible();
    await page.getByRole("link", { name: "Open John 3:16" }).click();
    await expect(page).toHaveURL(/\/en\/bible\/en-drc\/jhn\/3#v16$/);
  });

  test("words find verses, saints and celebrations with their next date", async ({ page }) => {
    await page.goto("/en/search?q=thomas");
    await expect(page.getByRole("region", { name: /Bible/ })).toContainText("Thomas");
    await expect(
      page.getByRole("region", { name: "Saints" }).getByRole("link", { name: "Saint Thomas", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Calendar" })).toContainText("Next:");
  });

  test("Tamil queries work", async ({ page }) => {
    await page.goto("/ta/search?q=சவேரியார்");
    await expect(page.getByRole("link", { name: /புனித பிரான்சிஸ் சவேரியார்/ }).first()).toBeVisible();
  });

  test("prayer text is searched and shown as a snippet", async ({ page }) => {
    await page.goto("/en/search?q=handmaid");
    await expect(page.getByRole("region", { name: "Prayers" })).toContainText("The Angelus");
    await expect(page.locator("mark", { hasText: /handmaid/i }).first()).toBeVisible();
  });

  test("nothing found is said plainly", async ({ page }) => {
    await page.goto("/en/search?q=zzqqxx");
    await expect(page.getByText("Nothing found for “zzqqxx”.")).toBeVisible();
  });

  test("the API groups results", async ({ request }) => {
    const body = await (await request.get("/api/search?q=jn%203:16&lang=en")).json();
    expect(body.reference.book).toBe("JHN");
    expect(body.readAtMass.length).toBeGreaterThan(0);
    const words = await (await request.get("/api/search?q=memorare&lang=en")).json();
    expect(words.results.some((r: { kind: string; key: string }) => r.kind === "prayer" && r.key === "memorare")).toBe(
      true,
    );
  });
});
