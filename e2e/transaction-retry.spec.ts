import { fulfillPostgrestRows } from "./postgrest-response";
import {test,expect,user} from "./fixtures";
import {mockReference} from "./reference-fixtures";

test.use({allowedConsoleErrors:["the server responded with a status of 503","the server responded with a status of 409"]});
for(const path of ["/accounts","/transactions"]){
  test(`retry after a lost save response creates one transaction from ${path}`,async({page})=>{
    await mockReference(page,"light");
    await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
    const rows=new Map<string,Record<string,unknown>>();
    const ids:string[]=[];
    await page.route("**/rest/v1/transactions**",async route=>{
      const request=route.request();
      const url=new URL(request.url());
      if(request.method()==="POST"){
        const raw=request.postDataJSON();
        const row=Array.isArray(raw)?raw[0]:raw;
        ids.push(row.id);
        if(rows.has(row.id)){await route.fulfill({status:409,json:{code:"23505",message:"duplicate key"}});return;}
        rows.set(row.id,{...row,created_at:"2026-10-15T08:00:00Z",updated_at:"2026-10-15T08:00:00Z"});
        await route.fulfill({status:503,json:{message:"Simulated response loss after commit"}});return;
      }
      const requestedId=url.searchParams.get("id")?.replace("eq.","");
      await fulfillPostgrestRows(route,[...rows.values()].filter(row=>!requestedId||row.id===requestedId));
    });
    await page.goto(path);
    await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();
    await page.getByRole("button",{name:"Catat manual",exact:true}).click();
    const editor=page.getByRole("dialog",{name:"Catat Transaksi",exact:true});
    await editor.locator("#nominal-input").fill("100");
    await editor.locator("#desc-input").fill("Retry audit");
    await editor.locator('[data-reference-node="catat.54"]').click();
    await page.getByRole("dialog",{name:"Pilih Rekening",exact:true}).getByRole("button",{name:/BCA Utama/}).click();
    await page.locator('[data-reference-node="pilih-rekening.136"]').click();
    await editor.locator('[data-reference-node="catat.70"]').click();
    await page.getByRole("button",{name:"Transportasi",exact:true}).click();
    const save=editor.getByRole("button",{name:"Simpan Transaksi",exact:true});
    await expect(save).toBeEnabled();
    await editor.locator("form").evaluate(form=>{
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
    });
    await expect.poll(()=>ids.length).toBe(1);
    await expect(page.getByRole("alert").filter({hasText:/Transaksi belum|Connection|response loss/})).toBeVisible();
    await page.reload();
    await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();
    await page.getByRole("button",{name:"Catat manual",exact:true}).click();
    await expect(editor.locator("#desc-input")).toHaveValue("Retry audit");
    await expect(editor.locator("#nominal-input")).toHaveValue("100");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole("heading",{name:"Transaksi Berhasil Dicatat",exact:true})).toBeVisible();
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids[1]).toBe(ids[0]);
    expect(rows.size).toBe(1);
  });
}
