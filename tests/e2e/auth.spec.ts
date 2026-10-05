import { expect, test } from "@playwright/test";

// These run without Supabase credentials, i.e. as a signed-out visitor.

test("admin pages send signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/ta/admin");
  await expect(page).toHaveURL(/\/ta\/login\?next=%2Fta%2Fadmin$/);
});

test("deep admin links keep their return path", async ({ page }) => {
  await page.goto("/en/admin/users?q=x");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/en/login");
  expect(url.searchParams.get("next")).toBe("/en/admin/users?q=x");
});

test("sign-in page explains when sign-in is unavailable", async ({ page }) => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), "Supabase is configured");
  await page.goto("/en/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Sign-in is not available yet.")).toBeVisible();
});

test("auth callback without a valid code fails safely", async ({ request }) => {
  const response = await request.get("/api/auth/callback?next=/en/admin", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/en\/login\?error=callback$/);
});

test("auth callback never redirects off-site", async ({ request }) => {
  const response = await request.get("/api/auth/callback?next=//evil.example/x", { maxRedirects: 0 });
  const location = new URL(response.headers().location);
  expect(location.hostname).toBe("localhost");
});
