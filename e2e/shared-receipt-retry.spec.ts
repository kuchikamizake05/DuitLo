import {test,expect,user} from "./fixtures";
import {mockReference} from "./reference-fixtures";
test.use({allowedConsoleErrors:["the server responded with a status of 503","the server responded with a status of 409"]});
test("shared receipt retry after reload reuses transaction and upload location",async({page})=>{
 await mockReference(page,"light");
 await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
 let row:Record<string,unknown>|null=null;const ids:string[]=[];const uploads:string[]=[];
 await page.route("**/storage/v1/object/receipts/**",route=>{uploads.push(new URL(route.request().url()).pathname);return route.fulfill({json:{Key:"receipt"}});});
 await page.route("**/api/receipts/parse",route=>route.fulfill({json:{extraction:{date:"2026-10-15",merchant:"Receipt retry",amount:100,note:"Receipt retry",categoryHint:null,type:"expense",proofKind:"receipt",rawText:null,confidence:.9}}}));
 await page.route("**/rest/v1/transactions**",async route=>{
  if(route.request().method()==="POST"){
   const raw=route.request().postDataJSON();const next=Array.isArray(raw)?raw[0]:raw;ids.push(next.id);
   if(row){await route.fulfill({status:409,json:{code:"23505",message:"duplicate"}});return;}
   row={...next,created_at:"2026-10-15T08:00:00Z",updated_at:"2026-10-15T08:00:00Z"};await route.fulfill({status:503,json:{message:"Lost response"}});return;
  }
  await route.fulfill({json:row?[row]:[]});
 });
 await page.goto("/dashboard");await page.waitForLoadState("networkidle");
 await page.evaluate(async()=>{const cache=await caches.open("fintrack-shared-receipts-v1");await cache.put("/__shared-receipts/retry/metadata",new Response(JSON.stringify({title:"Receipt",text:"",url:"",fileName:"receipt.png",fileType:"image/png"}),{headers:{"Content-Type":"application/json"}}));await cache.put("/__shared-receipts/retry/file",new Response(new Uint8Array([1,2,3]),{headers:{"Content-Type":"image/png"}}));});
 await page.goto("/shared-receipt?id=retry");
 await expect(page.getByLabel("Nominal",{exact:true})).toHaveValue("100");
 await page.locator('button[type="submit"]').click();await expect.poll(()=>ids.length).toBe(1);
 await expect(page.getByRole("alert").filter({hasText:"Draft belum tersimpan"})).toBeVisible();
 await page.reload();await expect(page.getByLabel("Nominal",{exact:true})).toHaveValue("100");
 await page.locator('button[type="submit"]').click();await expect(page).toHaveURL(/\/transactions$/);
 expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);expect(uploads).toHaveLength(2);expect(uploads[0]).toBe(uploads[1]);
 await page.waitForLoadState("networkidle");
});
