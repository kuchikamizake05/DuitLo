import {test,expect} from './fixtures';
import {mockReference} from './reference-fixtures';
for(const theme of ['light','dark'] as const)test(`planning renders each budget once and navigates periods ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.addInitScript(()=>localStorage.setItem('fintrack-language','en'));await page.clock.setFixedTime(new Date('2026-10-13T05:00:00Z'));
 await page.route('https://e2e-project.supabase.co/rest/v1/financial_budgets**',route=>route.fulfill({json:[{id:'budget-one',category:'Transportasi',limit_amount:1000000,month:'2026-10-01'},{id:'budget-two',category:'Belanja',limit_amount:1500000,month:'2026-10-01'}]}));
 await page.goto('/planning');await expect(page.locator(`main [data-reference-node="anggaran.${theme==='dark'?78:79}"]`)).toHaveCount(2);await expect(page.locator(`main [data-reference-node="anggaran.${theme==='dark'?84:85}"]`)).toHaveText(['Transportasi','Belanja']);await expect(page.locator(`[data-reference-node="anggaran.${theme==='dark'?51:52}"]`)).not.toContainText('—');
 await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('[data-reference-node="anggaran.29"]')).toHaveText('November 2026');await page.getByRole('button',{name:'Previous month',exact:true}).click();await expect(page.locator('[data-reference-node="anggaran.29"]')).toHaveText('October 2026');
 await page.getByRole('button',{name:'Select period',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.locator(`[data-reference-node="anggaran.${theme==='dark'?78:79}"]`).first().getByRole('button',{name:'Edit',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await page.waitForLoadState('networkidle');
});
