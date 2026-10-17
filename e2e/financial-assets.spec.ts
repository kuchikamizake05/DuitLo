import {test,expect} from "@playwright/test";
import {mockReference,account} from "./reference-fixtures";
import {fulfillPostgrestRows} from "./postgrest-response";

test("wallets show available balances without the removed asset summary",async({page})=>{
 await mockReference(page,"light");
 await page.route("**/rest/v1/financial_accounts**",route=>fulfillPostgrestRows(route,[{...account,current_balance:900000}]));
 await page.route("**/rest/v1/financial_goals**",route=>fulfillPostgrestRows(route,[{id:"saved",currency:"IDR",current_amount:100000,is_active:false}]));
 await page.goto("/accounts");
 await expect(page.getByText("BCA Utama",{exact:true}).first()).toBeVisible();
 await expect(page.locator("main")).toContainText("900.000");
 await expect(page.getByRole("region",{name:"Ringkasan aset",exact:true})).toHaveCount(0);
 await expect(page.getByText("Dana di goals",{exact:true})).toHaveCount(0);
});

test("foreign goal reserves do not replace available wallet balances",async({page})=>{
 await mockReference(page,"light");
 await page.route("**/rest/v1/financial_goals**",route=>fulfillPostgrestRows(route,[{id:"usd-saved",currency:"USD",current_amount:100,is_active:false}]));
 await page.goto("/accounts");
 await expect(page.getByText("BCA Utama",{exact:true}).first()).toBeVisible();
 await expect(page.locator("main")).toContainText("14.500.000");
 await expect(page.getByRole("region",{name:"Ringkasan aset",exact:true})).toHaveCount(0);
});

test("new goals start empty and receive funding only through deposits",async({page})=>{
 await mockReference(page,"light");
 const writes:Record<string,unknown>[]=[];
 await page.route("**/rest/v1/financial_goals**",async route=>{
  if(route.request().method()==="POST"){writes.push(route.request().postDataJSON());await route.fulfill({status:201,json:[]});}
  else await fulfillPostgrestRows(route,[]);
 });
 await page.goto("/goals?view=create");
 const editor=page.getByRole("dialog",{name:"Mulai Target Tabungan",exact:true});
 await expect(editor.locator("#initialDeposit")).toBeHidden();
 await editor.locator("#goalName").fill("Funded later");
 await editor.locator("#goalAmount").fill("2.000.000");
 await editor.locator("#btnSubmit").click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].current_amount).toBe(0);
});
