import {test,expect} from './fixtures';
import {mockReference} from './reference-fixtures';
for(const theme of ['light','dark'] as const)test(`activity filter selection and size ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.addInitScript(()=>localStorage.setItem('fintrack-language','en'));await page.goto('/transactions');
 const keys=['164','165','166','167','170'];
 const buttons=keys.map(key=>page.locator(`[data-reference-node="aktivitas.${key}"]`));
 for(const button of buttons)await expect(button).toBeVisible();
 const heights=await Promise.all(buttons.map(button=>button.evaluate(el=>el.getBoundingClientRect().height)));
 expect(new Set(heights).size).toBe(1);
 for(const index of [1,2,0]){await buttons[index].click();for(let other=0;other<3;other++)await expect(buttons[other]).toHaveAttribute('aria-pressed',String(index===other));}
 await expect(buttons[3]).not.toHaveAttribute('aria-pressed');
});
