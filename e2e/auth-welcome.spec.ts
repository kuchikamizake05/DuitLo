import {expect,test,mockSupabase} from "./fixtures";
for(const theme of ["light","dark"]){
 test(`welcome and account layout work in ${theme}`,async({page},info)=>{
  await mockSupabase(page,false);
  await page.addInitScript(value=>localStorage.setItem("fintrack-theme",value),theme);
  await page.goto("/login?welcome=1");
  await expect(page.getByLabel("Alamat email")).toBeVisible();
  await expect(page.locator(`img[data-login-theme="${theme}"]`)).toHaveCount(1);
  await expect(page.locator(`img[data-login-theme="${theme}"]`)).toBeVisible();
  await expect(page.locator(`img[data-login-theme="${theme==="dark"?"light":"dark"}"]`)).toBeHidden();
  await page.getByRole("button",{name:"Daftar",exact:true}).click();
  await expect(page.getByLabel("Konfirmasi kata sandi")).toBeVisible();
  await page.getByRole("button",{name:"Kembali",exact:true}).click();
  await expect(page.getByLabel("Konfirmasi kata sandi")).toHaveCount(0);
  const email=page.getByLabel("Alamat email");const password=page.getByLabel("Kata sandi",{exact:true});
  await expect(email).toBeVisible();
  const passwordBox=await password.boundingBox();const recoveryBox=await page.getByRole("button",{name:"Lupa kata sandi?"}).boundingBox();
  expect(recoveryBox!.y).toBeGreaterThan(passwordBox!.y+passwordBox!.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.frontend/stitch-login-${theme}-${info.project.name}.png`,fullPage:true});
 });
}
