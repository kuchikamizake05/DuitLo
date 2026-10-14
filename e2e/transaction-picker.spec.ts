import { test, expect } from "./fixtures";
import { account, mockReference } from "./reference-fixtures";

test("transaction account filters, balances and category scrolling", async ({ page }) => {
  await mockReference(page, "dark");
  await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts**", route => route.fulfill({json:[account,{...account,id:"wallet",name:"Digital",institution:"GoPay",kind:"ewallet",current_balance:250000}]}));
  await page.route("https://e2e-project.supabase.co/rest/v1/categories**", route => route.fulfill({json:Array.from({length:30},(_,i)=>({name:`Kategori ${String(i).padStart(2,"0")}`,type:"expense"}))}));
  await page.goto("/accounts");
  await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();
  await page.getByRole("button",{name:"Catat manual",exact:true}).click();
  await expect(page.locator('[data-reference-node="catat.26"]')).toHaveText("arrow_upward");
  await expect(page.locator('[data-reference-node="catat.29"]')).toHaveText("arrow_downward");
  await page.locator('[data-reference-node="catat.54"]').click();
  await page.locator('[data-reference-node="pilih-rekening.53"]').click();
  await expect(page.getByRole("button",{name:"Digital",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"BCA Utama",exact:true})).toHaveCount(0);
  await expect(page.locator('[data-reference-node="pilih-rekening.73"]')).toContainText("250.000");
  await page.keyboard.press("Escape");
  await page.locator('[data-reference-node="catat.70"]').click();
  const list = page.locator('[data-category-scroll]');
  await expect(list).toBeVisible();
  expect(await list.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(page.getByRole("button",{name:"Kategori 29",exact:true})).toBeInViewport();
});

