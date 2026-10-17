import { test, expect, user, mockAuthenticatedSession } from "./fixtures";
import { mockReference } from "./reference-fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`feature introduction previews all features without financial writes in ${theme}`, async ({ page }, testInfo) => {
    await mockReference(page, theme);
    const writes: string[] = [];
    page.on("request", request => {
      if (/\/rest\/v1\/(financial_accounts|transactions|financial_budgets|financial_goals)(?:\?|$)/.test(request.url()) && ["POST", "PATCH", "PUT", "DELETE"].includes(request.method())) writes.push(request.url());
    });
    await page.goto("/onboarding");
    const headings = ["Semua keuanganmu, satu ringkasan.", "Catat dengan caramu.", "Beri arah pada uangmu."];
    await expect(page.locator("input, select, textarea, form")).toHaveCount(0);
    await expect(page.getByRole("heading", { name:"Selamat datang di DuitLo!",exact:true })).toBeVisible();
    await page.getByRole("button", { name:"Lanjut",exact:true }).click();
    await expect(page.locator("main button[aria-pressed]")).toHaveCount(5);
    for (let index = 0; index < headings.length; index++) {
      await expect(page.getByRole("heading", { name: headings[index], exact: true })).toBeVisible();
      await expect.poll(() => page.getByRole("img", { name: /Preview fitur/ }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      if(index===0)await page.screenshot({ path:testInfo.outputPath("feature-intro.png"), fullPage:true });
      if (index < headings.length - 1) await page.getByRole("button", { name: "Lanjut", exact: true }).click();
    }
    await page.getByRole("button", { name: "Sebelumnya", exact: true }).click();
    await expect(page.getByRole("heading", { name: headings[1], exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Lanjut", exact: true }).click();
    await expect(page.getByRole("heading", { name:headings[2],exact:true })).toBeVisible();
    await page.getByRole("button", { name:"Lanjut",exact:true }).click();
    await expect(page.getByRole("heading", { name:"Sekarang giliranmu!",exact:true })).toBeVisible();
    await page.getByRole("button", { name: "Mulai pakai DuitLo", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Halo/ })).toBeVisible();
    expect(writes).toEqual([]);
    const progress = await page.evaluate(userId => JSON.parse(localStorage.getItem(`fintrack:onboarding:v1:${userId}`) ?? "null"), user.id);
    expect(progress?.completedAt).toBeTruthy();
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name:"Selamat datang di DuitLo!",exact:true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("introduction can be skipped before creating accounts or transactions", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(userId => localStorage.removeItem(`fintrack:onboarding:v1:${userId}`), user.id);
  await page.route("https://e2e-project.supabase.co/rest/v1/**", route => route.fulfill({json:[]}));
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Lewati", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Halo/ })).toBeVisible();
});

test("introduction is translated in English", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(() => localStorage.setItem("fintrack-language", "en"));
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to DuitLo!", exact: true })).toBeVisible();
  await page.getByRole("button", { name:"Next",exact:true }).click();
  await expect(page.getByRole("heading", { name: "Your finances in one summary.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Record transactions your way.", exact: true })).toBeVisible();
});

test("new account entering dashboard is directed to introduction", async ({page}) => {
  await mockAuthenticatedSession(page, false);
  await page.route("https://e2e-project.supabase.co/rest/v1/**", route => route.fulfill({json:[]}));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", {name:"Selamat datang di DuitLo!",exact:true})).toBeVisible();
});
