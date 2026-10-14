import { test, expect } from "./fixtures";
import { mockReference } from "./reference-fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`report month selection matches activity in ${theme}`, async ({ page }) => {
    await mockReference(page, theme);
    await page.clock.setFixedTime(new Date("2026-10-14T05:00:00Z"));
    await page.goto("/transactions");
    const activity = page.locator('[data-reference-node="aktivitas.19"]');
    await expect(activity).toBeVisible();
    const activityClass = await activity.getAttribute("class");
    await page.goto("/insights");
    const picker = page.locator('[data-reference-node="laporan.18"]');
    await expect(picker).toBeVisible();
    expect(await picker.getAttribute("class")).toBe(activityClass);
    await picker.click();
    const dialog = page.getByRole("dialog", { name: "Pilih periode" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Periode", { exact: true }).fill("2026-09");
    await expect(dialog).toBeHidden();
    await expect(picker).toContainText("Sep 2026");
    await picker.click();
    await expect(dialog.getByLabel("Periode", { exact: true })).toHaveValue("2026-09");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
}
