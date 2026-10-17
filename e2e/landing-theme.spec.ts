import { expect, test, mockSupabase } from "./fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`landing theme switch and install card follow ${theme} mode`, async ({ page }, info) => {
    await mockSupabase(page, false);
    await page.addInitScript(theme => {
      localStorage.setItem("fintrack-theme", theme);
      localStorage.setItem("fintrack-theme-system", "false");
      localStorage.removeItem("fintrack-install-dismissed-at");
    }, theme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/);
    await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    })));
    const card = page.locator("section").filter({ has: page.getByText("Pasang DuitLo", { exact: true }) });
    await expect(card).toHaveCSS("background-color", theme === "dark" ? "rgb(32, 32, 36)" : "rgb(255, 255, 255)");
    await card.getByRole("button", { name: "Ingatkan nanti", exact: true }).click();
    if (info.project.name === "mobile-chromium") await page.getByRole("button", { name: "Menu navigasi", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "Mode gelap", exact: true });
    await expect(toggle).toHaveAttribute("aria-checked", String(theme === "dark"));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", String(theme !== "dark"));
    expect(await page.evaluate(() => localStorage.getItem("fintrack-theme"))).toBe(theme === "dark" ? "light" : "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
