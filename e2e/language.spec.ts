import { expect, test } from "@playwright/test";

test("language choice switches the UI to English and survives reload", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  if (isMobile) await page.getByLabel("Menu navigasi", { exact: true }).click();
  await page.getByRole("button", { name: "Inggris", exact: true }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: /Your money,.*your plans\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in", exact: true }).first()).toBeVisible();

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: /Your money,.*your plans\./ })).toBeVisible();
  if (isMobile) await page.getByLabel("Navigation menu", { exact: true }).click();
  await expect(page.getByRole("button", { name: "English", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
});
