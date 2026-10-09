import {test,expect} from './fixtures';
import {mockReference} from './reference-fixtures';
for(const theme of ['light','dark'] as const)test(`institution logos and searchable choices ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.addInitScript(()=>localStorage.setItem('fintrack-language','en'));await page.goto('/accounts');
 await expect(page.locator('main img[src="/institutions/bca-mark.svg"]').first()).toBeVisible();
 await page.goto('/accounts?view=create');await page.locator('[data-reference-node="tambah-akun.49"]').click();
 const dialog=page.getByRole('dialog',{name:'Select bank or wallet',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.locator('button[aria-pressed]')).toHaveCount(36);
 await dialog.getByRole('textbox',{name:'Search banks or e-wallets'}).fill('DANA');await expect(dialog.getByRole('button',{name:/DANA/})).toBeVisible();
 await dialog.getByRole('button',{name:/DANA/}).click();await expect(dialog).not.toBeVisible();
 await expect(page.locator('[data-reference-node="tambah-akun.51"] img')).toHaveAttribute('src','/institutions/dana-mark.svg');
 await expect(page.locator('#category-select')).toHaveValue('ewallet');
 await page.locator('[data-reference-node="tambah-akun.49"]').click();await dialog.getByRole('textbox',{name:'Search banks or e-wallets'}).fill('Neobank');await dialog.getByRole('button',{name:/Bank Neo Commerce/}).click();await expect(page.locator('#category-select')).toHaveValue('bank');
 const logo=page.locator('[data-reference-node="tambah-akun.51"] img');await expect(logo).toHaveAttribute('src','/institutions/bnc.svg');expect(await logo.evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
});
