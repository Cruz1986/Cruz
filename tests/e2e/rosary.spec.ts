import { expect, test } from "@playwright/test";

const withData = Boolean(process.env.E2E_DATA);

test.describe("rosary without data", () => {
  test.skip(withData, "data is configured");

  test("explains that the Rosary is not available yet", async ({ page }) => {
    await page.goto("/en/rosary");
    await expect(page.getByRole("heading", { level: 1, name: "Rosary" })).toBeVisible();
    await expect(page.getByText("The Rosary is not available yet.")).toBeVisible();
  });
});

test.describe("rosary with data", () => {
  test.skip(!withData, "set E2E_DATA=1 with imported prayers and Rosary");

  test("lists the four sets with today's first", async ({ page }) => {
    await page.goto("/en/rosary");
    await expect(page.getByText("Today's mysteries")).toBeVisible();
    for (const name of ["Joyful", "Luminous", "Sorrowful", "Glorious"])
      await expect(page.getByRole("heading", { level: 2, name: `${name} Mysteries` })).toBeVisible();
  });

  test("guides through the decades and counts the Hail Marys", async ({ page }) => {
    await page.goto("/en/rosary/sorrowful");
    await expect(page.getByRole("heading", { name: "Sign of the Cross" })).toBeVisible();
    const next = page.getByRole("button", { name: "Next" });
    for (let i = 0; i < 7; i++) await next.click();
    await expect(page.getByRole("heading", { name: "The Agony in the Garden" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Luke 22:39-46/ })).toBeVisible();
    for (let i = 0; i < 4; i++) await next.click();
    await expect(page.getByRole("heading", { name: "Hail Mary 3 of 10" })).toBeVisible();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByRole("heading", { name: "Hail Mary 2 of 10" })).toBeVisible();
  });

  test("progress is kept on the device and can be resumed", async ({ page }) => {
    await page.goto("/en/rosary/glorious");
    const next = page.getByRole("button", { name: "Next" });
    for (let i = 0; i < 3; i++) await next.click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("rosary:progress"))).toContain("glorious");
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page).toHaveURL(/\/en\/rosary$/);
    await page.getByRole("link", { name: /Continue where you left off/ }).click();
    await expect(page.getByText("Continuing where you left off.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hail Mary 1 of 3" })).toBeVisible();
  });

  test("jumps to a decade", async ({ page }) => {
    await page.goto("/en/rosary/joyful");
    await page.getByRole("button", { name: "Go to decade 5" }).click();
    await expect(page.getByRole("heading", { name: "The Finding of Jesus in the Temple" })).toBeVisible();
  });

  test("the Tamil guide shows Tamil mystery titles", async ({ page }) => {
    await page.goto("/ta/rosary/joyful");
    await page.getByRole("button", { name: "5ஆம் பத்துக்குச் செல்" }).click();
    await expect(page.getByRole("heading", { level: 2 }).first()).toHaveAttribute("lang", "ta");
  });

  test("the API returns today's mysteries", async ({ request }) => {
    const body = await (await request.get("/api/rosary/today")).json();
    expect(["joyful", "luminous", "sorrowful", "glorious"]).toContain(body.set.key);
    expect(body.mysteries).toHaveLength(5);
  });
});
