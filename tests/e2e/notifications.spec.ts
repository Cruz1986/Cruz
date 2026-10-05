import { expect, test } from "@playwright/test";
import { signInAs } from "./support/session";

const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test("the reminder job refuses calls without the scheduler's secret", async ({ request }) => {
  const response = await request.get("/api/cron/notifications");
  expect([401, 503]).toContain(response.status());
});

test.describe("daily reminder settings", () => {
  test.skip(!authConfigured, "set NEXT_PUBLIC_SUPABASE_URL");

  test("signed-out readers are asked to sign in", async ({ page }) => {
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { name: "Daily reminder" })).toBeVisible();
    await expect(page.getByText("Sign in to get a daily reminder")).toBeVisible();
  });
});

const secret = process.env.E2E_JWT_SECRET;
const readerId = process.env.E2E_USER_ID;
const staffId = process.env.E2E_STAFF_ID;

test.describe("signed in", () => {
  test.skip(!secret || !readerId || !staffId, "set E2E_JWT_SECRET, E2E_USER_ID and E2E_STAFF_ID");
  test.describe.configure({ mode: "serial" });

  test("a reader saves their reminder time, parts and time zone", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, readerId!);
    await page.goto("/en/settings");
    const card = page
      .locator("section, div")
      .filter({ has: page.getByRole("heading", { name: "Daily reminder" }) })
      .last();
    await card.getByLabel("Today's Rosary mysteries").setChecked(test.info().project.name === "mobile");
    await card.getByLabel("Time", { exact: true }).fill("07:30");
    await card.getByRole("combobox", { name: /Time zone/ }).selectOption("Asia/Colombo");
    await card.getByRole("button", { name: "Save reminder" }).click();
    await expect(card.getByRole("status")).toHaveText("Saved.");

    await page.reload();
    await expect(page.getByLabel("Time", { exact: true })).toHaveValue("07:30");
    await expect(page.getByRole("combobox", { name: /Time zone/ })).toHaveValue("Asia/Colombo");
    await expect(page.getByLabel("Today's Rosary mysteries")).toBeChecked({
      checked: test.info().project.name === "mobile",
    });
  });

  test("content admins schedule and cancel an announcement", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, staffId!);
    const title = `Test announcement ${test.info().project.name}`;
    await page.goto("/en/admin/notifications/new");
    await page.getByLabel("Title (English)").fill(title);
    await page.getByLabel("Title (Tamil)").fill("சோதனை அறிவிப்பு");
    await page.getByLabel("Opens (path in the app)").fill("/rosary");
    await page.getByLabel("Send at (India time)").fill("2030-12-24T18:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/notifications\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Cancel announcement" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/notifications$/);
    const item = page.getByRole("link", { name: new RegExp(title) });
    await expect(item).toContainText("Cancelled");
  });

  test("the path an announcement opens is checked", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, staffId!);
    await page.goto("/en/admin/notifications/new");
    await page.getByLabel("Title (English)").fill("Bad link");
    await page.getByLabel("Title (Tamil)").fill("தவறு");
    await page.getByLabel("Opens (path in the app)").fill("https://example.com");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Please correct the highlighted fields.")).toBeVisible();
  });
});
