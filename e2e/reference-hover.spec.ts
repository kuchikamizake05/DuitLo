import {test,expect} from "./fixtures";
import {mockReference} from "./reference-fixtures";
for (const theme of ["light","dark"] as const) test(`primary card hover remains usable in ${theme}`, async ({page,isMobile})=>{
 test.skip(isMobile,"Touch devices do not expose pointer hover.");
 await mockReference(page,theme);
 await page.goto("/accounts");
 const card=page.locator('[data-reference-node="dompet.29"]').first();
 await expect(card).toBeVisible();
 const before=await card.boundingBox();
 await card.hover();
 expect(await card.boundingBox()).toEqual(before);
 await expect(card.getByRole("button",{name:"Sembunyikan saldo"})).toBeEnabled();
});
