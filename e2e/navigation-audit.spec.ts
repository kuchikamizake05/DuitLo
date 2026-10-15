import {test,expect,user} from "./fixtures";
import {mockReference} from "./reference-fixtures";

test.beforeEach(async ({page})=>{
  await mockReference(page,"light");
  await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
});

test("integration rows explain their own feature instead of navigating to unrelated reports",async({page})=>{
  await page.goto("/settings");
  await page.locator('[data-reference-node="pengaturan.163"]').click();
  await expect(page).toHaveURL(/\/settings$/);
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Telegram");
  await page.keyboard.press("Escape");
  await page.locator('[data-reference-node="pengaturan.154"]').click();
  await expect(dialog).toContainText("Google Drive");
  await expect(dialog).toContainText("belum tersedia");
});

test("changing shared receipt IDs clears the previous receipt draft",async({page})=>{
  await page.goto("/dashboard");
  await page.evaluate(async()=>{
    const cache=await caches.open("fintrack-shared-receipts-v1");
    for(const id of ["audit-first","audit-second"]){
      await cache.put(`/__shared-receipts/${id}/metadata`,new Response(JSON.stringify({title:id,text:`Note ${id}`,url:"",fileName:null,fileType:null}),{headers:{"Content-Type":"application/json"}}));
    }
  });
  await page.goto("/shared-receipt?id=audit-first");
  await expect(page.getByLabel("Merchant / penerima")).toHaveValue("audit-first");
  await page.getByLabel("Nominal",{exact:true}).fill("12345");
  await page.evaluate(()=>window.history.pushState(null,"","/shared-receipt?id=audit-second"));
  await expect(page.getByLabel("Merchant / penerima")).toHaveValue("audit-second");
  await expect(page.getByLabel("Catatan",{exact:true})).toHaveValue("Note audit-second");
  await expect(page.getByLabel("Nominal",{exact:true})).toBeEmpty();
});

test("goal create URL opens the goal editor",async({page})=>{
  await page.goto("/goals?view=create");
  await expect(page.getByRole("dialog")).toBeVisible();
});
