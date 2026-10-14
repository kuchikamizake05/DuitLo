import {expect,test,mockSupabase} from "./fixtures";
for(const theme of ["light","dark"]){
 test(`login sheet overlays the new illustration in ${theme}`,async({page},info)=>{
  await mockSupabase(page,false);await page.addInitScript(value=>localStorage.setItem("fintrack-theme",value),theme);
  await page.goto("/login");
  const sheet=page.getByRole("main");
  await expect(page.getByRole("heading",{name:"Masuk ke FinTrack",exact:true})).toBeVisible();
  await expect(sheet).toHaveCSS("border-top-left-radius","32px");
  await expect(sheet).toHaveCSS("background-color",theme==="dark"?"rgb(32, 32, 36)":"rgb(255, 255, 255)");
  expect(await sheet.evaluate(element=>getComputedStyle(element).animationName)).toContain("auth-sheet-slide");
  await expect(sheet).toHaveCSS("transform","matrix(1, 0, 0, 1, 0, 0)");
  const art=page.locator(`img[data-login-theme="${theme}"]:visible`);
  await expect(art).toBeVisible();await expect.poll(()=>art.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path:`.frontend/login-sheet-${theme}-${info.project.name}.png`,fullPage:true});
  await page.getByRole("button",{name:"Daftar",exact:true}).click();
  const confirmation=page.getByLabel("Konfirmasi kata sandi");await confirmation.fill("rahasia123");
  await confirmation.scrollIntoViewIfNeeded();await expect(confirmation).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
test("login sheet respects reduced motion",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});await mockSupabase(page,false);await page.goto("/login");
 await expect(page.getByRole("heading",{name:"Masuk ke FinTrack",exact:true})).toBeVisible();
 await expect(page.getByRole("main")).toHaveCSS("animation-name","none");
});
