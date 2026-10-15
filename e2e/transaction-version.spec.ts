import {test,expect,user} from "./fixtures";
import {mockReference,transaction} from "./reference-fixtures";
for(const action of ["edit","delete"] as const)test(`stale ${action} cannot overwrite another tab`,async({page})=>{
 await mockReference(page,"light");
 await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
 let row={...transaction};let accepted=0;let patches=0;
 await page.route("**/rest/v1/transactions**",async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==="PATCH"){
   patches++;
   expect(url.searchParams.get("user_id")).toBe(`eq.${user.id}`);
   if(url.searchParams.get("updated_at")!==`eq.${row.updated_at}`){await route.fulfill({json:[]});return;}
   accepted++;row={...row,...route.request().postDataJSON(),updated_at:"2026-10-15T08:00:00Z"};
   await route.fulfill({json:[{id:row.id}]});return;
  }
  await route.fulfill({json:[row]});
 });
 await page.goto(`/transactions?view=detail&id=${row.id}`);
 const detail=page.getByRole("dialog",{name:"Detail",exact:true});await expect(detail).toBeVisible();
 if(action==="edit"){
  await detail.getByRole("button",{name:"Edit Transaksi",exact:true}).click();
  const editor=page.getByRole("dialog",{name:"Edit transaksi",exact:true});await editor.locator("#edit-amount").fill("300000");
  row={...row,amount:200000,updated_at:"2026-10-15T09:00:00Z"};
  await editor.getByRole("button",{name:"Simpan Perubahan",exact:true}).click();
 }else{
  await detail.getByRole("button",{name:"Hapus Transaksi",exact:true}).click();
  row={...row,amount:200000,updated_at:"2026-10-15T09:00:00Z"};
  await page.getByRole("dialog",{name:/Hapus/}).getByRole("button",{name:/Hapus Transaksi|Ya, Hapus/}).click();
 }
 await expect(page.getByRole("alert").filter({hasText:"Transaksi sudah berubah"})).toBeVisible();
 expect(patches).toBe(1);expect(accepted).toBe(0);expect(row.amount).toBe(200000);expect(row.status).toBe("confirmed");
});
