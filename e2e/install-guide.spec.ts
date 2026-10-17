import { expect, test, mockSupabase } from "./fixtures";

for (const language of ["id", "en"]) {
  test(`installation guide works without a native prompt in ${language}`, async ({ page }, info) => {
    await mockSupabase(page, false);
    await page.addInitScript((value) => {
      localStorage.setItem("fintrack-language", value);
      localStorage.setItem("fintrack-theme", "dark");
    }, language);
    await page.goto("/");
    const mobile = info.project.name === "mobile-chromium";
    if (mobile) await page.getByRole("button", { name: language === "en" ? "Navigation menu" : "Menu navigasi", exact: true }).click();
    const trigger = page.getByRole("button", { name: language === "en" ? "Install App" : "Instal App", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: language === "en" ? "Install DuitLo" : "Instal DuitLo" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("http://127.0.0.1:3100");
    await expect(dialog.getByRole("button", { name: language === "en" ? "Install now" : "Instal sekarang", exact: true })).toHaveCount(0);
    const ios = dialog.getByRole("button", { name: "iOS (iPhone / iPad) — Safari", exact: true });
    await ios.click();
    await expect(ios).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.locator("#install-ios")).toContainText("Add to Home Screen");
    const android = dialog.getByRole("button", { name: "Android — Chrome", exact: true });
    await android.click();
    await expect(ios).toHaveAttribute("aria-expanded", "false");
    await expect(android).toHaveAttribute("aria-expanded", "true");
    await expect(dialog).toHaveCSS("background-color", "rgb(32, 32, 36)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.frontend/install-guide-${language}-${info.project.name}.png` });
    await dialog.getByRole("button", { name: language === "en" ? "Close" : "Tutup", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}

test("installation guide invokes a captured browser prompt", async ({ page }, info) => {
  await mockSupabase(page, false);
  await page.goto("/");
  if (info.project.name === "mobile-chromium") await page.getByRole("button", { name: "Menu navigasi", exact: true }).click();
  await page.getByRole("button", { name: "Instal App", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Instal DuitLo" });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => { document.documentElement.dataset.installPrompt = "called"; },
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    window.dispatchEvent(event);
  });
  await dialog.getByRole("button", { name: "Instal sekarang", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt", "called");
  await expect(dialog.getByRole("button", { name: "Instal sekarang", exact: true })).toHaveCount(0);
});
