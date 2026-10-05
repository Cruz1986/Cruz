import { expect, test } from "@playwright/test";

test.describe("with an English browser", () => {
  test.use({ locale: "en-US" });

  test("root opens in Tamil", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ta$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  });

  test("root remembers a language the reader chose", async ({ page }) => {
    await page.goto("/en/prayers");
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });
});

test("today's readings are one tap from home", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/today$/);
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
});

test("switching language keeps the current page", async ({ page }) => {
  await page.goto("/ta/prayers");
  await page
    .getByRole("link", { name: /English/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/prayers$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("unknown pages return 404 with a localised message", async ({ page }) => {
  const response = await page.goto("/ta/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("பக்கம் கிடைக்கவில்லை")).toBeVisible();
});

test("text size and theme persist across reloads", async ({ page }) => {
  await page.goto("/en/settings");
  await page.getByRole("button", { name: "Increase text size" }).click();
  await page.getByText("Dark", { exact: true }).click();
  await page.reload();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("style", /--font-scale:\s*1\.125/);
});
