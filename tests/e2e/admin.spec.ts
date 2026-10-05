import { expect, test } from "@playwright/test";
import { signInAs } from "./support/session";

const ADMIN_PAGES = [
  "/en/admin/calendar",
  "/en/admin/reflections/new",
  "/en/admin/rosary",
  "/en/admin/media",
  "/en/admin/sources",
  "/en/admin/audit",
  "/en/admin/bible/books",
];

test("admin pages require signing in", async ({ page }) => {
  for (const path of ADMIN_PAGES) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  }
});

const withData = Boolean(process.env.E2E_DATA);
const staffId = process.env.E2E_STAFF_ID; // a content admin in auth.users

test.describe("content management", () => {
  test.skip(!withData || !process.env.E2E_JWT_SECRET || !staffId, "set E2E_JWT_SECRET and E2E_STAFF_ID");
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, staffId!));

  test("the dashboard shows content by status and recent changes", async ({ page }) => {
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { name: "Content by status" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Saints" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent changes" })).toBeVisible();
  });

  test("a published reflection appears on the Today page and in the history", async ({ page }) => {
    const title = `Test reflection ${test.info().project.name}`;
    const date = test.info().project.name === "mobile" ? "2026-11-02" : "2026-11-03";
    await page.goto(`/en/admin/reflections/new?date=${date}`);
    await page.locator("form [name=language]").selectOption("en");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Reflection", { exact: true }).fill("A short test reflection.\n\nSecond paragraph.");
    await page.getByLabel("Author").fill("Test author");
    await page.locator("[name=status]").selectOption("published");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/reflections\/[0-9a-f-]{36}$/);

    await page.goto(`/en/today/${date}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Second paragraph.")).toBeVisible();

    await page.goto("/en/admin/audit?type=reflections");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();

    await page.getByRole("link", { name: title }).first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/reflections$/);
    await page.goto(`/en/today/${date}`);
    await expect(page.getByRole("heading", { name: title })).toBeHidden();
  });

  test("publishing is refused while a source is not verified", async ({ page }) => {
    await page.goto("/en/admin/bible/ta-tcb2012/settings");
    await page.locator("[name=status]").selectOption("published");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/can't be published/)).toBeVisible();
  });

  test("a reading reference is checked before it is saved", async ({ page }) => {
    await page.goto("/en/admin/calendar?date=2026-12-03");
    await page
      .getByRole("link", { name: /Edit reading: எசா/ })
      .first()
      .click();
    const reference = page.getByLabel("Reference");
    const original = await reference.inputValue();
    await reference.fill("not a reference");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("This reference could not be read.")).toBeVisible();
    await reference.fill(original);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("the calendar day editor and the media library open", async ({ page }) => {
    await page.goto("/en/admin/calendar?date=2026-12-03");
    await expect(page.getByLabel("Title (English)")).toHaveValue(/Francis Xavier/);
    await page.goto("/en/admin/media/new");
    await expect(page.getByLabel("Image file")).toBeVisible();
  });
});
