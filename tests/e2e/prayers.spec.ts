import { expect, test } from "@playwright/test";

const withData = Boolean(process.env.E2E_DATA);

test.describe("prayers without data", () => {
  test.skip(withData, "data is configured");

  test("explains that prayers are not available yet", async ({ page }) => {
    await page.goto("/en/prayers");
    await expect(page.getByText("Prayers are not available yet.")).toBeVisible();
  });
});

test.describe("prayers with data", () => {
  test.skip(!withData, "set E2E_DATA=1 with imported prayers");

  test("lists prayers by category and opens one", async ({ page }) => {
    await page.goto("/en/prayers");
    await expect(page.getByRole("heading", { level: 2, name: "Essential prayers" })).toBeVisible();
    await page.getByRole("link", { name: "Our Father" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Our Father" })).toBeVisible();
    await expect(page.getByText("hallowed be thy name")).toBeVisible();
    await expect(page.getByText(/public domain/)).toBeVisible();
  });

  test("search finds prayers by their text as well as their title", async ({ page }) => {
    await page.goto("/en/prayers");
    await page.getByLabel("Search prayers").fill("handmaid");
    await expect(page.getByRole("link", { name: "The Angelus" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Our Father" })).toBeHidden();
  });

  test("a saved prayer appears in the saved list", async ({ page }) => {
    await page.goto("/en/prayers/memorare");
    await page.getByRole("button", { name: "Save prayer" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/en/prayers");
    await expect(page.getByRole("heading", { name: "Saved on this device" })).toBeVisible();
  });

  test("the Tamil page says when a Tamil text is not available yet", async ({ page }) => {
    await page.goto("/ta/prayers/hail-mary");
    await expect(page.getByText("இச்செபத்தின் தமிழ் வடிவம்")).toBeVisible();
  });

  test("the API returns a prayer with its attribution", async ({ request }) => {
    const body = await (await request.get("/api/prayers/glory-be")).json();
    expect(body.text.en).toContain("world without end");
    expect(body.attribution).toMatch(/public domain/i);
  });

  test("the prayer admin requires signing in", async ({ page }) => {
    await page.goto("/en/admin/prayers/new");
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  });
});
