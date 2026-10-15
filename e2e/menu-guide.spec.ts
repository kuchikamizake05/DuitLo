import { test, expect, user } from "./fixtures";
import { mockReference } from "./reference-fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`menu tour covers all main menus and remembers completion in ${theme}`, async ({ page }, testInfo) => {
    await mockReference(page, theme);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Panduan menu", exact: true }).click();
    const guide = page.getByRole("complementary", { name: "Panduan langkah pertama" });
    await expect(guide.getByRole("heading", { name: "Beranda", exact: true })).toBeVisible();
    await expect.poll(() => guide.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("menu-tour.png") });
    await guide.getByRole("button", { name: "Lanjut", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", { name: "Dompet", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/accounts$/);
    await guide.getByRole("button", { name: "Sebelumnya", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", { name: "Beranda", exact: true })).toBeVisible();
    await guide.getByRole("button", { name: "Lanjut", exact: true }).click();
    await guide.getByRole("button", { name: "Lanjut", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", { name: "Catat", exact: true })).toBeVisible();
    await page.locator('nav a[href="/transactions?new=1"].ft-guide-target').click();
    await expect(page.getByRole("button", { name: "Catat manual", exact: true })).toBeVisible();
    await guide.getByRole("button", { name: "Lanjut", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", { name: "Aktivitas", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Catat manual", exact: true })).toHaveCount(0);
    await guide.getByRole("button", { name: "Lanjut", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", { name: "Laporan", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/insights$/);
    await guide.getByRole("button", { name:"Lanjut",exact:true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", {name:"Anggaran",exact:true})).toBeVisible();
    await expect(page.locator('[data-guide="budget"]')).toHaveClass(/ft-guide-target/);
    await guide.getByRole("button", {name:"Lanjut",exact:true}).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", {name:"Target Tabungan",exact:true})).toBeVisible();
    await expect(page.locator('[data-guide="goal"]')).toHaveClass(/ft-guide-target/);
    await guide.getByRole("button", { name: "Selesai", exact: true }).click();
    await expect(guide).toHaveCount(0);
    await page.reload();
    await expect(guide).toHaveCount(0);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Panduan menu", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(guide.getByRole("heading", { name: "Beranda", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
  });
}

test("skipping the menu tour is remembered", async ({ page }) => {
  await mockReference(page, "light");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Panduan menu", exact: true }).click();
  await page.getByRole("button", { name: "Lewati", exact: true }).click();
  await expect.poll(() => page.evaluate(userId => localStorage.getItem(`fintrack:menu-guide:${userId}`), user.id)).toBe("0");
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Panduan langkah pertama" })).toHaveCount(0);
});

test("new user must save essential data before advancing practice steps", async ({page}) => {
  await mockReference(page,"light");
  let savedAccount = false;
  let savedTransaction = false;
  await page.route("https://e2e-project.supabase.co/rest/v1/**", route => {
    const path=new URL(route.request().url()).pathname;
    return route.fulfill({json:path.endsWith("financial_accounts") && savedAccount ? [{id:"practice-account"}] : path.endsWith("transactions") && savedTransaction ? [{id:"practice-transaction"}] : []});
  });
  await page.goto("/dashboard?tutorial=start");
  const guide=page.getByRole("complementary");
  await guide.getByRole("button",{name:"Lanjut",exact:true}).click();
  await expect(page.locator('[data-guide="add-wallet"]')).toHaveClass(/ft-guide-target/);
  await expect(guide.getByRole("button",{name:"Lanjut",exact:true})).toHaveCount(0);
  savedAccount=true;
  await page.evaluate(()=>window.dispatchEvent(new Event("fintrack:setup-data-saved")));
  await expect(guide.getByRole("heading",{name:"Catat",exact:true})).toBeVisible();
  await expect(guide.getByRole("button",{name:"Lanjut",exact:true})).toHaveCount(0);
  savedTransaction=true;
  await page.evaluate(()=>window.dispatchEvent(new Event("fintrack:setup-data-saved")));
  await expect(guide.getByRole("heading",{name:"Aktivitas",exact:true})).toBeVisible();
  await expect(guide.getByRole("button",{name:"Lanjut",exact:true})).toBeVisible();
});
