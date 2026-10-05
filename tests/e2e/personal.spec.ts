import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

const withData = Boolean(process.env.E2E_DATA);

async function selectVerse(page: Page, verse: number) {
  await page.locator(`#v${verse}`).click();
  await expect(page.getByRole("toolbar")).toBeVisible();
}

test.describe("personal library on this device", () => {
  test.skip(!withData, "set E2E_DATA=1 with an imported Bible, prayers and saints");

  test("verses can be highlighted, bookmarked and given a note", async ({ page }) => {
    await page.goto("/en/bible/en-drc/jhn/3");
    await selectVerse(page, 16);
    await page.getByRole("button", { name: "Highlight" }).click();
    await page.getByRole("button", { name: "Yellow" }).click();
    await page.getByRole("button", { name: "Bookmark" }).click();
    await page.getByRole("button", { name: "Note" }).click();
    await page.getByRole("textbox", { name: "Note" }).fill("Remember at Mass");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Clear selection" }).click();

    const verse = page.locator("#v16");
    await expect(verse).toHaveAttribute("data-highlight", "yellow");
    await expect(verse).toHaveAttribute("data-bookmarked", "");
    await expect(verse).toHaveAttribute("data-noted", "");

    await page.reload();
    await expect(page.locator("#v16")).toHaveAttribute("data-highlight", "yellow");

    await page.goto("/en/library");
    await expect(page.getByRole("region", { name: /Bookmarks/ })).toContainText("John 3:16");
    await expect(page.getByRole("region", { name: /Highlights/ })).toContainText("Yellow");
    await expect(page.getByRole("region", { name: /Notes/ })).toContainText("Remember at Mass");
    await expect(page.getByText("Saved on this device")).toBeVisible();
  });

  test("a highlight follows the verse into the other translation", async ({ page }) => {
    await page.goto("/en/bible/en-drc/jhn/3");
    await selectVerse(page, 16);
    await page.getByRole("button", { name: "Highlight" }).click();
    await page.getByRole("button", { name: "Green" }).click();
    const key = await page.locator("#v16").getAttribute("data-key");
    expect(key).toBeTruthy();
    // Removing it again from the same palette
    await page.getByRole("button", { name: "Highlight" }).click();
    await page.getByRole("button", { name: "Remove highlight" }).click();
    await expect(page.locator("#v16")).not.toHaveAttribute("data-highlight", /.+/);
  });

  test("favourites, notes and history for prayers and saints", async ({ page }) => {
    await page.goto("/en/saints/thomas");
    await page.getByRole("button", { name: "Add to favourites" }).click();
    await expect(page.getByRole("button", { name: "In favourites" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Note" }).click();
    await page.getByRole("textbox", { name: "Note" }).fill("Visit San Thome");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("complementary", { name: "Note" })).toContainText("Visit San Thome");

    await page.goto("/en/prayers/memorare");
    await page.getByRole("button", { name: "Save prayer" }).click();

    await page.goto("/en/library");
    const favourites = page.getByRole("region", { name: /Favourites/ });
    await expect(favourites).toContainText("Saint Thomas");
    await expect(favourites).toContainText("Memorare");
    const history = page.getByRole("region", { name: /Recently opened/ });
    await expect(history).toContainText("Memorare");
    await expect(history).toContainText("Saint Thomas");

    await page.getByRole("button", { name: "Remove Memorare" }).first().click();
    await expect(favourites).not.toContainText("Memorare");
    await page.getByRole("button", { name: "Clear history" }).click();
    await expect(page.getByText("Chapters, prayers and saints you open appear here.")).toBeVisible();
  });

  test("the library page explains how to keep it on every device", async ({ page }) => {
    await page.goto("/ta/library");
    await expect(page.getByRole("heading", { level: 1, name: "என் நூலகம்" })).toBeVisible();
    await expect(page.getByText("இந்தச் சாதனத்தில் சேமிக்கப்பட்டுள்ளது")).toBeVisible();
  });
});

/*
 * Account sync needs a signed-in session. Against a local stack, set E2E_JWT_SECRET (its JWT secret)
 * and E2E_USER_ID (a row in auth.users).
 */
const secret = process.env.E2E_JWT_SECRET;
const userId = process.env.E2E_USER_ID;
const signIn = (context: BrowserContext, baseURL: string) => signInAs(context, baseURL, userId!);

test.describe("personal library in the account", () => {
  test.skip(!withData || !secret || !userId, "set E2E_JWT_SECRET and E2E_USER_ID to test account sync");
  test.describe.configure({ mode: "serial" });

  test("items saved before signing in move to the account and appear on another device", async ({
    browser,
    baseURL,
  }) => {
    const slug = test.info().project.name === "mobile" ? "angelus" : "anima-christi";
    const first = await browser.newContext();
    const page = await first.newPage();
    await page.goto(`/en/prayers/${slug}`);
    await page.getByRole("button", { name: "Save prayer" }).click();
    await signIn(first, baseURL!);
    await page.goto("/en/library");
    await expect(page.getByText("Saved to your account")).toBeVisible();

    const second = await browser.newContext();
    await signIn(second, baseURL!);
    const other = await second.newPage();
    await other.goto("/en/library");
    await expect(other.getByText("Saved to your account")).toBeVisible();
    const favourites = other.getByRole("region", { name: /Favourites/ });
    const name = slug === "angelus" ? "The Angelus" : "Soul of Christ (Anima Christi)";
    await expect(favourites).toContainText(name);

    // Removing it on the second device removes it from the account.
    await other
      .getByRole("button", { name: `Remove ${name}` })
      .first()
      .click();
    await expect(favourites).not.toContainText(name);
    await page.waitForTimeout(500);
    const third = await browser.newContext();
    await signIn(third, baseURL!);
    const check = await third.newPage();
    await check.goto("/en/library");
    await expect(check.getByText("Saved to your account")).toBeVisible();
    await expect(check.getByRole("region", { name: /Favourites/ })).not.toContainText(name);
    await Promise.all([first.close(), second.close(), third.close()]);
  });
});
