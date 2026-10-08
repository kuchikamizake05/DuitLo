import { expect, mockSupabase, test } from "./fixtures";

test.describe("FinTrack navigation and appearance @critical", () => {
  test("mobile navigation opens quick entry with the keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true);
    await page.goto("/dashboard");
    const navigation = page.getByRole("navigation", { name: "Navigasi utama" });
    await expect(navigation.getByRole("link", { name: "Beranda" })).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByRole("link", { name: "Laporan" })).toHaveAttribute("href", "/insights");
    const trigger = navigation.getByRole("link", { name: "Catat Transaksi Baru" });
    await trigger.focus();
    await trigger.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("theme selection persists across navigation and reload", async ({ page }, testInfo) => {
    await mockSupabase(page, true);
    await page.route("https://e2e-project.supabase.co/auth/v1/passkeys", route => route.fulfill({status:200,json:[]}));
    await Promise.all([page.waitForResponse(response => response.url().endsWith("/auth/v1/passkeys")), page.goto("/settings")]);
    await page.getByRole("button", { name: "Gelap", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/accounts");
    await expect(page.getByText("Mulai dari dompet pertamamu",{exact:true})).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({path:testInfo.outputPath("accounts-dark.png"),fullPage:true});
    await page.reload();
    await expect(page.getByText("Mulai dari dompet pertamamu",{exact:true})).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await Promise.all([page.waitForResponse(response => response.url().endsWith("/auth/v1/passkeys")), page.goto("/settings")]);
    await expect(page.getByRole("button", { name: "Gelap", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Terang", exact: true }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`wallet cards and actions render in ${theme}`, async ({page}, testInfo) => {
    await page.setViewportSize({width:390,height:844});
    await mockSupabase(page,true);
    await page.addInitScript(value => localStorage.setItem("fintrack-theme",value),theme);
    await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts?**", route => route.fulfill({status:200,json:[
      {id:"bank",name:"BCA Utama",kind:"bank",institution:"BCA",currency:"IDR",current_balance:14500000,reporting_balance_idr:null,is_active:true,updated_at:"2026-10-12T00:00:00Z"},
      {id:"wallet",name:"GoPay",kind:"ewallet",institution:"GoPay",currency:"IDR",current_balance:1450000,reporting_balance_idr:null,is_active:true,updated_at:"2026-10-12T00:00:00Z"}
    ]}));
    await page.goto("/accounts");
    const carousel = page.locator(".ft-reference[data-page=dompet]");
    await expect(carousel.locator("[data-reference-node=\"dompet.29\"]")).toHaveCount(2);
    await expect(carousel.locator("[data-reference-node=\"dompet.29\"]").first()).toContainText(/14\.500\.000/);
    await carousel.locator("[data-reference-node=\"dompet.29\"]").first().getByRole("button",{name:"Sembunyikan saldo"}).click();
    await expect(carousel.locator("[data-reference-node=\"dompet.29\"]").first()).toContainText("••••••");
    await page.screenshot({path:testInfo.outputPath(`wallet-${theme}.png`),fullPage:true});
    await page.getByRole("button",{name:"Transfer Saldo Antar akun"}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
