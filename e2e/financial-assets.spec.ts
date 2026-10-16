import {test,expect} from "@playwright/test";
import {mockReference,account} from "./reference-fixtures";
import {fulfillPostgrestRows} from "./postgrest-response";

test("wallet summary keeps reserved archived goal funds visible as assets",async({page})=>{
 await mockReference(page,"light");
 await page.route("**/rest/v1/financial_accounts**",route=>fulfillPostgrestRows(route,[{...account,current_balance:900000}]));
 await page.route("**/rest/v1/financial_goals**",route=>fulfillPostgrestRows(route,[{id:"saved",currency:"IDR",current_amount:100000,is_active:false}]));
 await page.goto("/accounts");
 const summary=page.getByRole("region",{name:"Ringkasan aset",exact:true});
 await expect(summary).toBeVisible();
 await expect(summary.getByText("Dana di goals",{exact:true})).toBeVisible();
 await expect(summary).toContainText("900.000");
 await expect(summary).toContainText("100.000");
 await expect(summary).toContainText("1.000.000");
});

test("unknown foreign goal conversion does not display a false total",async({page})=>{
 await mockReference(page,"light");
 await page.route("**/rest/v1/financial_goals**",route=>fulfillPostgrestRows(route,[{id:"usd-saved",currency:"USD",current_amount:100,is_active:false}]));
 await page.goto("/accounts");
 const summary=page.getByRole("region",{name:"Ringkasan aset",exact:true});
 await expect(summary).toBeVisible();
 await expect(summary.getByText("—",{exact:true})).toHaveCount(2);
 await expect(summary).toContainText("USD");
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
