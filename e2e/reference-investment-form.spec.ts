import {test,expect} from "./fixtures";
import {mockReference,account} from "./reference-fixtures";
for(const theme of ["light","dark"] as const)test(`investment purchase uses real inputs in ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts**",route=>route.fulfill({json:[{...account,kind:"investment",name:"Stockbit"}]}));let writes=0;let record:Record<string,unknown>={};
 await page.route("https://e2e-project.supabase.co/rest/v1/stock_executions**",route=>{if(route.request().method()==="POST"){writes++;record=route.request().postDataJSON();}return route.fulfill({json:[]});});
 await page.goto("/investments?view=create");const form=page.getByRole("dialog",{name:"Tambah Investasi",exact:true});await expect(form.locator("#asset-ticker")).toBeVisible();await expect(form.locator("#asset-name")).toBeHidden();
 await form.locator("#asset-ticker").fill("bbca");await form.locator("#input-lot").fill("1");await form.locator("#input-price").fill("8500");await form.locator("#input-fee").fill("100");await form.getByLabel("Waktu eksekusi",{exact:true}).fill("2026-10-13T10:30");await form.getByLabel("Catatan (opsional)",{exact:true}).fill("Pembelian uji");
 await expect(form.locator("#display-total")).toContainText("850.100");await expect(form.locator("#display-total")).toHaveCSS("color","rgb(255, 255, 255)");await form.getByRole("button",{name:"Simpan Investasi",exact:true}).click();await expect.poll(()=>writes).toBe(1);
 expect(record).toMatchObject({ticker:"BBCA",quantity:100,price:8500,fee:100,account_id:account.id,note:"Pembelian uji",executed_at:"2026-10-13T03:30:00.000Z"});
});

for(const theme of ["light","dark"] as const)test(`investment categories can be selected and saved in ${theme}`,async({page})=>{
 await mockReference(page,theme);await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts**",route=>route.fulfill({json:[{...account,kind:"investment"}]}));let record:Record<string,unknown>|null=null;
 await page.route("https://e2e-project.supabase.co/rest/v1/stock_executions**",route=>{if(route.request().method()==="POST")record=route.request().postDataJSON();return route.fulfill({json:[]});});
 await page.goto("/investments?view=create");const form=page.getByRole("dialog",{name:"Tambah Investasi",exact:true});
 for(const name of ["Reksa Dana","Emas Logam","Kripto","Lainnya","Saham"]){const button=form.getByRole("button",{name,exact:true});await button.click();await expect(button).toHaveAttribute("aria-pressed","true");}
 await form.getByRole("button",{name:"Emas Logam",exact:true}).click();await form.locator("#asset-name").fill("Emas Antam");await form.locator("#input-lot").fill("2");await form.locator("#input-price").fill("1000000");await expect(form.locator("#input-lot")).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
 await expect(form.locator("#display-total")).toContainText("2.000.000");await form.getByRole("button",{name:"Simpan Investasi",exact:true}).click();await expect.poll(()=>record).not.toBeNull();expect(record).toMatchObject({quantity:2,price:1000000,ticker:"GOLD-EMASANTAM"});expect(JSON.parse(String(record!.note))).toMatchObject({category:"gold",name:"Emas Antam"});
});
