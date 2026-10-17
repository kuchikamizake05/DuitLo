import { fulfillPostgrestRows } from "./postgrest-response";
import {test,expect,user} from "./fixtures";
import {account,transaction,mockReference} from "./reference-fixtures";
test.beforeEach(async ({page})=>{
 await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
});
for(const theme of ["light","dark"] as const){
 test(`reference ${theme}: source font and theme color survive application tokens`,async({page})=>{
  await mockReference(page,theme);await page.goto("/accounts");await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();await page.getByRole("button",{name:"Catat manual",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Catat Transaksi",exact:true});await expect(dialog.locator("#nominal-input")).toBeVisible();
  const styles=await dialog.locator('#nominal-input').evaluate(node=>({size:getComputedStyle(node).fontSize,color:getComputedStyle(node).color}));expect(parseFloat(styles.size)).toBeGreaterThanOrEqual(24);

  await dialog.getByRole("button",{name:"+20rb",exact:true}).click();await expect(dialog.locator("#nominal-input")).toHaveValue("20.000");await dialog.locator('[data-reference-node="catat.70"]').click();await expect(page.getByRole("dialog",{name:"Pilih Kategori",exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(dialog).toBeVisible();await expect(page.getByRole("dialog",{name:"Pilih Kategori",exact:true})).toHaveCount(0);
  await page.screenshot({path:`.frontend/qa-catat-${theme}-${test.info().project.name}.png`,fullPage:true});
 });
 test(`reference ${theme}: transaction deep link opens real detail then source edit`,async({page})=>{
  await mockReference(page,theme);await page.goto(`/transactions?view=detail&id=${transaction.id}`);const detail=page.getByRole("dialog",{name:"Detail",exact:true});await expect(detail).toBeVisible();await expect(detail.getByText(transaction.merchant,{exact:true})).toBeVisible();await detail.getByRole("button",{name:"Edit Transaksi",exact:true}).click();const edit=page.getByRole("dialog",{name:"Edit transaksi",exact:true});await expect(edit.locator("#edit-amount")).toHaveValue("250.000");await expect(edit.locator("#edit-title")).toHaveValue(transaction.merchant);await expect(edit.locator("#edit-notes")).toHaveValue(transaction.note);
 });
}

for(const theme of ["light","dark"] as const){test(`reference ${theme}: primary routes retain source shell without horizontal overflow`,async({page})=>{
 await mockReference(page,theme);
 for(const [path,source] of [["/dashboard","beranda"],["/accounts","dompet"],["/transactions","aktivitas"],["/insights","laporan"],["/planning","anggaran"],["/goals","target"],["/investments","portofolio"]]){
  await page.goto(path);const root=page.locator(`.ft-reference[data-page="${source}"]`).first();await expect(root.locator("main")).toBeVisible();await expect(page.getByRole("navigation",{name:"Navigasi utama"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(source==="laporan"){const dimensions=await root.locator('[data-reference-node="laporan.43"]').evaluate(node=>({card:node.getBoundingClientRect().width,parent:node.parentElement!.getBoundingClientRect().width}));expect(dimensions.card).toBeCloseTo(dimensions.parent,0);}
  await page.screenshot({path:`.frontend/qa-${source}-${theme}-${test.info().project.name}.png`,fullPage:true});
 }
});}

test("reference goal form submits once and account action opens source form",async({page})=>{
 await mockReference(page,"light");let writes=0;await page.route("https://e2e-project.supabase.co/rest/v1/financial_goals**",async route=>{if(route.request().method()==="POST")writes++;await route.fulfill({status:200,json:[]});});
 await page.goto("/accounts");await page.getByRole("button",{name:/Tambah Akun Bank/}).click();await expect(page.getByRole("dialog",{name:"Tambah Rekening Baru",exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.goto("/goals?view=create");const goal=page.getByRole("dialog",{name:"Mulai Target Tabungan",exact:true});await expect(goal).toBeVisible();await goal.locator("#goalName").fill("Tujuan Pengujian");await goal.locator("#goalAmount").fill("1.000.000");await goal.locator("#btnSubmit").click();await expect(goal).toHaveCount(0);expect(writes).toBe(1);
});

test("reference investment confirmation saves once and asset deletion stays scoped",async({page})=>{
 await mockReference(page,"dark");const broker={...account,kind:"investment",name:"Broker Uji"};const executions=[{id:"execution-fixture",user_id:user.id,account_id:account.id,ticker:"BBCA",side:"buy",quantity:1000,price:8500,fee:0,currency:"IDR",executed_at:"2026-10-12T07:00:00Z",note:null}];let writes=0;let deletion:URL|null=null;
 await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts**",route=>fulfillPostgrestRows(route,[broker]));
 await page.route("https://e2e-project.supabase.co/rest/v1/stock_executions**",async route=>{if(route.request().method()==="POST"){writes++;executions.push({...route.request().postDataJSON(),id:"execution-new"});}if(route.request().method()==="DELETE")deletion=new URL(route.request().url());await route.fulfill({status:200,json:executions});});
 await page.goto("/investments");await page.locator('[data-reference-node="portofolio.91"]').click();const detail=page.getByRole("dialog",{name:"BBCA",exact:true});await expect(detail).toBeVisible();await detail.getByRole("button",{name:"Catat Penjualan",exact:true}).click();const editor=page.getByRole("dialog",{name:"Catat eksekusi",exact:true});await expect(editor).toBeVisible();await editor.locator("#lotInput").fill("1");await editor.locator("#priceInput").fill("9.000");await editor.getByRole("button",{name:"Lanjutkan Konfirmasi",exact:true}).click();const summary=page.getByRole("dialog",{name:"Konfirmasi Transaksi",exact:true});await expect(summary).toBeVisible();expect(writes).toBe(0);await summary.getByRole("button",{name:"Simpan Transaksi",exact:true}).click();const result=page.getByRole("dialog",{name:"Investasi Berhasil Disimpan",exact:true});await expect(result).toBeVisible();expect(writes).toBe(1);await result.getByRole("button",{name:"Lihat Detail Aset",exact:true}).click();await expect(detail).toBeVisible();await detail.getByRole("button",{name:"Opsi lainnya",exact:true}).click();const confirm=page.getByRole("dialog",{name:/Hapus Catatan Aset BBCA/});await expect(confirm).toBeVisible();expect(deletion).toBeNull();await confirm.getByRole("button",{name:"Hapus Catatan Aset",exact:true}).click();await expect(confirm).toHaveCount(0);expect(deletion).not.toBeNull();expect(deletion!.searchParams.get("user_id")).toBe(`eq.${user.id}`);expect(deletion!.searchParams.get("account_id")).toBe(`eq.${account.id}`);expect(deletion!.searchParams.get("ticker")).toBe("eq.BBCA");
});

test("reference foreign currency input preserves amount through formatting and save",async({page})=>{
 await mockReference(page,"light");const foreign={...account,currency:"USD",current_balance:20000};const payloads:Record<string,unknown>[]=[];await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts**",route=>fulfillPostgrestRows(route,[foreign]));await page.route("https://e2e-project.supabase.co/rest/v1/transactions**",async route=>{if(route.request().method()==="POST"){const batch=route.request().postDataJSON();expect(Array.isArray(batch)).toBe(true);expect(batch).toHaveLength(1);payloads.push(batch[0]);}await route.fulfill({status:200,json:[]});});await page.goto("/accounts");await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();await page.getByRole("button",{name:"Catat manual",exact:true}).click();const form=page.getByRole("dialog",{name:"Catat Transaksi",exact:true});await form.locator("#nominal-input").fill("12345,67");await expect(form.locator("#nominal-input")).toHaveValue("12345,67");await form.locator("#desc-input").fill("Pembelian USD");await form.locator('[data-reference-node="catat.70"]').click();await page.getByRole("dialog",{name:"Pilih Kategori",exact:true}).getByRole("button",{name:"Transportasi",exact:true}).click();await form.getByRole("button",{name:"Simpan Transaksi",exact:true}).click();await expect(page.getByRole("dialog",{name:"Hasil Transaksi",exact:true})).toBeVisible();expect(payloads).toHaveLength(1);expect(payloads[0].amount).toBe(12345.67);expect(payloads[0].account_id).toBe(foreign.id);
});


test("source transaction form keeps typing focus while values update",async({page})=>{
 await mockReference(page,"dark");await page.goto("/accounts");await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();await page.getByRole("button",{name:"Catat manual",exact:true}).click();
 const input=page.getByRole("dialog",{name:"Catat Transaksi",exact:true}).locator("#merchant-input");await input.focus();await input.pressSequentially("Pengujian Fokus",{delay:30});await expect(input).toHaveValue("Pengujian Fokus");await expect(input).toBeFocused();
});


test("source budget detail uses real usage and updates the existing budget",async({page})=>{
 await mockReference(page,"light");await page.clock.setFixedTime(new Date("2026-10-13T05:00:00Z"));let updates=0;let writes=0;
 await page.route("https://e2e-project.supabase.co/rest/v1/financial_budgets**",async route=>{if(route.request().method()==="PATCH"){updates++;expect(new URL(route.request().url()).searchParams.get("id")).toBe("eq.budget-test");}if(route.request().method()==="POST")writes++;await route.fulfill({status:200,json:[{id:"budget-test",category:"Transportasi",month:"2026-10-01",limit_amount:1000000}]});});
 await page.goto("/planning?view=edit&id=budget-test");const editor=page.getByRole("dialog",{name:"Edit Anggaran",exact:true});await expect(editor).toBeVisible();await expect(editor.locator('[data-reference-node="edit-anggaran.32"]')).toContainText("250.000");await expect(editor.locator('[data-reference-node="edit-anggaran.38"]')).toContainText("25.0% terpakai");await editor.locator("#budget-limit").fill("2.000.000");await editor.locator('[data-reference-node="edit-anggaran.148"]').click();await expect(editor).toHaveCount(0);expect(updates).toBe(1);expect(writes).toBe(0);
});

test("source goal detail replaces sample values and back returns to the goal list",async({page})=>{
 await mockReference(page,"dark");await page.clock.setFixedTime(new Date("2026-10-13T05:00:00Z"));await page.route("https://e2e-project.supabase.co/rest/v1/financial_goals**",route=>fulfillPostgrestRows(route,[{id:"goal-test",name:"Tujuan Nyata",target_amount:10000000,current_amount:1000000,currency:"IDR",due_date:"2027-01-13",is_active:true}]));
 await page.goto("/goals?view=detail&id=goal-test");const detail=page.getByRole("dialog",{name:"Tujuan Nyata",exact:true});await expect(detail).toBeVisible();await expect(detail.locator('[data-reference-node="detail-target.37"]')).toContainText("9.000.000");await expect(detail.locator('[data-reference-node="detail-target.47"]')).toContainText("3.000.000");await detail.getByRole("button",{name:/Kembali/}).first().click();await expect(detail).toHaveCount(0);await expect(page).toHaveURL(/goals/);await expect(page.locator('[data-page="target"] main')).toBeVisible();
});


test("dark source attribute selectors retain charcoal balance and amber streak",async({page})=>{
 await mockReference(page,"dark");await page.goto("/dashboard");await expect(page.locator("#main-balance")).toBeVisible();
 const colors=await page.locator("#main-balance").evaluate(node=>{const top=node.parentElement!.parentElement!;const streak=document.querySelector('section[aria-label="Jaga Konsistensi"] span[class*="bg-[#fff0dc]"]');return {hero:getComputedStyle(top).backgroundImage,streak:streak?getComputedStyle(streak).backgroundColor:null};});
 expect(colors.hero).toContain("radial-gradient");expect(colors.hero).toContain("rgb(41, 44, 51)");expect(colors.streak).toBe("rgba(255, 152, 0, 0.1)");await expect(page.getByRole("button",{name:"ID",exact:true})).toHaveCSS("background-color","rgb(168, 196, 252)");
 await page.screenshot({path:`.frontend/qa-dark-colors-${test.info().project.name}.png`,fullPage:true});
});
