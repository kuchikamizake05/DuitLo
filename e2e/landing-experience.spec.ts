import { test, expect } from "@playwright/test";

test("hero scroll motion follows scrolling and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const preview = page.locator('#overview [class*="heroPreview"]').filter({ visible: true });
  const start = await preview.evaluate(element => getComputedStyle(element).transform);
  await page.evaluate(() => window.scrollTo(0, 350));
  await expect.poll(() => preview.evaluate(element => getComputedStyle(element).transform)).not.toBe(start);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(preview).toHaveCSS("transform", "none");
  await page.evaluate(() => window.scrollTo(0, 350));
  await expect(preview).toHaveCSS("transform", "none");
});

for (const theme of ["light", "dark"] as const) {
  test(`landing interactions and bilingual navigation in ${theme}`, async ({ page, isMobile }) => {
    await page.addInitScript(theme => {
      localStorage.setItem("fintrack-theme", theme);
      localStorage.setItem("fintrack-language", "id");
    }, theme);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text()); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("#overview h1")).toContainText("Duit lo");
    await page.getByRole("tab", { name: "Laporan", exact: true }).click();
    await expect(page.getByRole("tabpanel").getByRole("img")).toHaveAttribute("src", /reports/);
    await page.getByRole("tab", { name: "Laporan", exact: true }).press("Home");
    await expect(page.getByRole("tab", { name: "Ringkasan", exact: true })).toBeFocused();
    await expect(page.locator("#receipt").getByText("Transaksi berhasil disimpan", { exact: true })).toBeVisible({ timeout: 20000 });
    const faq = page.locator("#faq details").filter({ hasText: "Bisa dipakai di HP?" });
    await faq.locator("summary").click();
    await expect(faq.locator("p")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (isMobile) await page.getByRole("button", { name: "Menu navigasi", exact: true }).click();
    await page.getByRole("button", { name: "Inggris", exact: true }).filter({ visible: true }).click();
    await expect(page.locator("#overview h1")).toContainText("Your money");
    if (isMobile) {
      await page.locator("#landing-menu").getByRole("link", { name: "FAQ", exact: true }).click();
      await expect(page.locator("#landing-menu")).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Start with one entry", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  });
}
