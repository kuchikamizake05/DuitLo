import { fulfillPostgrestRows } from "./postgrest-response";
import {test,expect,user} from './fixtures';
import {mockReference,account} from './reference-fixtures';
for(const theme of ['light','dark'] as const)test(`new account controls and single logo background ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.addInitScript(()=>localStorage.setItem('fintrack-language','en'));
 let saved:Record<string,unknown>|null=null;
 await page.route('https://e2e-project.supabase.co/rest/v1/financial_accounts**',async route=>{
  if(route.request().method()==='POST'){saved={...route.request().postDataJSON(),id:'new-account',is_active:true};await route.fulfill({json:{id:'new-account'}});}else await fulfillPostgrestRows(route,saved?[account,saved]:[account]);
 });
 await page.goto('/accounts?view=create');const tab=(name:string)=>page.locator(`#tab-${name}`);
 await tab('ewallet').click();await expect(tab('ewallet')).toHaveAttribute('aria-pressed','true');await expect(tab('bank')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#category-select')).toHaveValue('ewallet');
 await tab('cash').click();await expect(tab('cash')).toHaveAttribute('aria-pressed','true');await tab('bank').click();await expect(tab('bank')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('group',{name:'Card color theme',exact:true}).getByRole('button',{name:'Red',exact:true}).click();await expect(page.getByRole('button',{name:'Red',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Blue',exact:true}).click();await expect(page.getByRole('button',{name:'Blue',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Green',exact:true})).toHaveAttribute('aria-pressed','false');
 await page.locator('[data-reference-node="tambah-akun.82"]').press('Enter');await page.getByRole('dialog',{name:'Currency',exact:true}).getByRole('combobox').selectOption('USD');await expect(page.locator('[data-reference-node="tambah-akun.82"]')).toContainText('USD');
 await page.locator('[data-reference-node="tambah-akun.82"]').click();await page.getByRole('dialog',{name:'Currency',exact:true}).getByRole('combobox').selectOption('IDR');
 const totalSwitch=page.locator('[data-reference-node="tambah-akun.91"]');expect(await totalSwitch.locator('div').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(11, 87, 208)');await totalSwitch.click();await expect(page.locator('#include-networth-toggle')).not.toBeChecked();
 await page.locator('#custom-name-input').fill('Test blue account');await page.locator('#initial-balance-input').fill('100000');
 const badge=page.locator('[data-reference-node="tambah-akun.28"]');expect(await badge.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');expect(await badge.locator('[data-institution-logo]').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
 await page.locator('#toggle-visibility-btn').click();await expect(page.locator('[data-reference-node="tambah-akun.20"]')).toContainText('••••••');await page.locator('#toggle-visibility-btn').click();
 await page.locator('#save-account-btn').click();await expect(page.locator('#save-account-btn')).toHaveCount(0);expect(saved?.['kind']).toBe('bank');
 const preferences=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null'),`fintrack:account-display:${user.id}:new-account`);expect(preferences).toEqual({cardColor:'royal-blue',includeInNetWorth:false});
 await expect(page.getByText('Test blue account',{exact:true}).first()).toBeVisible();await expect(page.getByText('Included balance',{exact:true})).toBeVisible();await expect(page.locator('[data-reference-node="dompet.21"]')).toContainText('14.500.000');await page.waitForLoadState('networkidle');
});
