import {test,expect,mockSupabase,user} from "./fixtures";
test("manual install works after automatic prompt dismissal",async({page})=>{
 await mockSupabase(page,true);await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
 await page.addInitScript(()=>localStorage.setItem("fintrack-install-dismissed-at",String(Date.now())));
 await page.goto("/settings");
 await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
 await page.evaluate(()=>{
  Reflect.set(window,"installPromptCalls",0);
  const event=Object.assign(new Event("beforeinstallprompt",{cancelable:true}),{prompt:async()=>Reflect.set(window,"installPromptCalls",Number(Reflect.get(window,"installPromptCalls"))+1),userChoice:Promise.resolve({outcome:"accepted",platform:"web"})});
  window.dispatchEvent(event);
 });
 await expect(page.getByRole("button",{name:"Pasang",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Pasang DuitLo",exact:true}).click();
 expect(await page.evaluate(()=>Reflect.get(window,"installPromptCalls"))).toBe(1);
 await expect(page.getByText("Permintaan instalasi diterima",{exact:true})).toBeVisible();
});
test("manual install explains browser installation when unavailable",async({page})=>{
 await mockSupabase(page,true);await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);await page.goto("/settings");
 await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Pasang DuitLo",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Instal DuitLo",exact:true});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole("button",{name:"Android — Chrome",exact:true})).toBeVisible();
 await expect(dialog.getByRole("button",{name:"iOS (iPhone / iPad) — Safari",exact:true})).toBeVisible();
 await dialog.getByRole("button",{name:"Tutup",exact:true}).click();await expect(dialog).toHaveCount(0);
});
