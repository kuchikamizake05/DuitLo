import {test,expect} from "./fixtures";
import {transaction,mockReference} from "./reference-fixtures";

for(const theme of ["light","dark"] as const){test(`category colors differ and remain consistent in ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.clock.setFixedTime(new Date("2026-10-13T05:00:00Z"));const categories=["Makanan","Transportasi","Belanja"];
 await page.route("https://e2e-project.supabase.co/rest/v1/transactions**",route=>route.fulfill({json:categories.map((category,index)=>({...transaction,id:`tx-${index}`,category,merchant:category,amount:(index+1)*100000}))}));
 await page.route("https://e2e-project.supabase.co/rest/v1/categories**",route=>route.fulfill({json:categories.map(name=>({name,type:"expense"}))}));
 const baseline:Record<string,{background:string;color:string}>={};
 for(const path of ["/dashboard","/transactions","/insights"]){await page.goto(path);await expect(page.locator("main")).toBeVisible();const colors=[];
  for(const category of categories){const icon=page.locator(`[data-category-icon="${category}"]`).filter({visible:true}).first();await expect(icon).toBeVisible();const color=await icon.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));colors.push(color.background);if(path==="/dashboard")baseline[category]=color;else expect(color).toEqual(baseline[category]);}
  expect(new Set(colors).size).toBe(3);
  if(path==="/transactions")for(const category of categories){const label=page.locator(`[data-category-label="${category}"]`).first();await expect(label).toHaveCSS("color",baseline[category].color);}
  if(path==="/insights"){
   for(const category of categories){const progress=page.locator('[data-reference-node="laporan.128"]').filter({has:page.locator(`[data-category-icon="${category}"]`)});if(await progress.count())await expect(progress.locator('[data-reference-node="laporan.140"]')).toHaveCSS("background-color",baseline[category].color);}
   await page.locator('[data-reference-node="laporan.62"]').click();
   for(const category of categories)await expect(page.locator(`#report-bar-chart [role="img"][aria-label^="${category}:"]`)).toHaveCSS("background-color",baseline[category].color);
  }if(path==="/insights")await page.screenshot({path:`.frontend/qa-categories-${theme}-${test.info().project.name}.png`,fullPage:true});
 }
 await page.goto("/accounts");await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();const editor=page.getByRole("dialog",{name:"Catat Transaksi",exact:true});await expect(editor.locator("#nominal-input")).toBeEnabled();await editor.locator('[data-reference-node="catat.70"]').click();const picker=page.getByRole("dialog",{name:"Pilih Kategori",exact:true});await expect(picker).toBeVisible();
 for(const category of categories){const color=await picker.locator(`[data-category-icon="${category}"]`).evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));expect(color).toEqual(baseline[category]);}
 await picker.getByRole("button",{name:"Makanan",exact:true}).click();await expect(editor.locator('[data-category-icon="Makanan"]')).toBeVisible();
});}
