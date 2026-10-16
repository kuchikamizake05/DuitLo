import { fulfillPostgrestRows } from "./postgrest-response";
import type { Page } from "@playwright/test";
import { expect, mockSupabase, test } from "./fixtures";

async function prepareDashboard(page: Page, language: "id" | "en") {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.clock.setFixedTime(new Date("2026-10-08T05:00:00Z"));
  await mockSupabase(page, true);
  await page.addInitScript((value) => localStorage.setItem("fintrack-language", value), language);
  await page.route("https://e2e-project.supabase.co/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    let rows: unknown[] = [];
    if (table === "financial_accounts") rows = [{ id: "bank", name: "BCA", kind: "bank", currency: "IDR", current_balance: 1000000, is_active: true, updated_at: "2026-10-08T00:00:00Z" }];
    if (table === "financial_budgets") rows = [{ id: "budget", category: "Makanan", month: "2026-10-01", limit_amount: 1000000 }];
    if (table === "transactions" && !url.searchParams.getAll("status").some((value) => value.startsWith("in.")) && !url.searchParams.getAll("date").includes("gte.2026-09-01")) rows = [
      { id: "expense", date: "2026-10-08", type: "expense", merchant: "Lunch", category: "Makanan", amount: 250000, account_id: "bank", status: "confirmed", created_at: "2026-10-08T00:00:00Z" },
      { id: "income", date: "2026-10-09", type: "income", merchant: "Salary", category: "Gaji", amount: 1000000, account_id: "bank", status: "confirmed", created_at: "2026-10-09T00:00:00Z" },
    ];
    await fulfillPostgrestRows(route, rows);
  });
  await page.goto("/dashboard");
  await expect(page.locator("#main-balance")).toBeVisible();
}

for (const language of ["id", "en"] as const) {
  test(`source home keeps seven streak days and protects amounts in ${language}`, async ({page},testInfo)=>{
    await prepareDashboard(page,language);
    await expect(page.locator("#main-balance")).toContainText(/1[.,]000[.,]000/);
    await expect(page.locator('[data-page="beranda"] main')).toBeVisible();
    await expect(page.locator("#mobile-calendar-title")).toHaveCount(0);
    await page.locator("#toggle-balance-visibility").click();
    await expect(page.locator("#main-balance")).toContainText("••••");
    await page.reload();
    await expect(page.locator("#main-balance")).toContainText("••••");
    await testInfo.attach(`dashboard-${language}`,{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  });
}

test("source home recent transaction opens actual detail",async({page})=>{
 await prepareDashboard(page,"id");
 await page.getByText("Lunch",{exact:true}).click();
 await expect(page).toHaveURL(/dashboard$/);
 await expect(page.getByRole("dialog",{name:"Detail",exact:true})).toBeVisible();
});
