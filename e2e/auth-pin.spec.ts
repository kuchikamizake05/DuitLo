import {test,expect,mockSupabase,user} from "./fixtures";
import {mockReference} from "./reference-fixtures";
import {configureDevicePin,devicePinKey} from "../src/lib/device-pin";
import {buildPasskeyDeviceStorageKey} from "../src/lib/passkeys";
async function lockedDevice(page: import("@playwright/test").Page,theme:"light"|"dark"){
 await mockReference(page,theme);
 let record="";await configureDevicePin(user.id,"123456",{getItem:()=>record||null,setItem:(_key,value)=>{record=value;},removeItem:()=>{record="";}});
 await page.addInitScript(({record,pinKey,stateKey,id})=>{localStorage.setItem(pinKey,record);localStorage.setItem(stateKey,JSON.stringify({version:1,userId:id,emailHint:"qa••@fintrack.local",enabled:true,locked:true,updatedAt:"2026-10-14T00:00:00Z"}));},{record,pinKey:devicePinKey(user.id),stateKey:buildPasskeyDeviceStorageKey(user.id),id:user.id});
}
for(const theme of ["light","dark"] as const){
 test(`normal login follows the ${theme} application palette`,async({page},info)=>{
  await mockSupabase(page,false);await page.addInitScript(value=>localStorage.setItem("fintrack-theme",value),theme);await page.goto("/login");
  const card=page.getByRole("region",{name:"Masuk ke FinTrack",exact:true});await expect(card).toBeVisible();
  await expect(card).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
  await expect(page.getByLabel("Alamat email")).toHaveCSS("background-color",theme==="dark"?"rgb(28, 29, 32)":"rgb(238, 245, 240)");
  await expect(page.getByLabel("Alamat email")).toHaveCSS("border-top-width","0px");
  await expect(page.getByRole("button",{name:"Masuk dengan Google",exact:true})).toHaveCSS("background-color",theme==="dark"?"rgb(39, 40, 45)":"rgb(238, 245, 240)");
  await expect(page.getByRole("button",{name:"Masuk",exact:true})).toHaveCSS("background-color",theme==="dark"?"rgb(168, 196, 252)":"rgb(21, 128, 61)");
  const primary=page.getByRole("button",{name:"Masuk",exact:true});
  const tokens=await page.evaluate(()=>{const root=getComputedStyle(document.documentElement);return {background:root.getPropertyValue("--create-bg").trim(),foreground:root.getPropertyValue("--create-fg").trim()};});
  expect(await primary.evaluate((button,tokens)=>{const reference=document.createElement("button");reference.style.backgroundColor=tokens.background;reference.style.color=tokens.foreground;document.body.append(reference);const actual=getComputedStyle(button),expected=getComputedStyle(reference);const matches=actual.backgroundColor===expected.backgroundColor&&actual.color===expected.color;reference.remove();return matches;},tokens)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.frontend/auth-login-${theme}-${info.project.name}.png`,fullPage:true});
 });
 test(`PIN unlock verifies attempts and follows ${theme} mode`,async({page},info)=>{
  await lockedDevice(page,theme);await page.goto("/dashboard");
  const card=page.getByRole("region",{name:"Buka FinTrack",exact:true});await expect(card).toBeVisible();
  await expect(card.getByRole("button",{name:"Buka dengan biometrik",exact:true})).toBeVisible();
  await page.screenshot({path:`.frontend/auth-pin-${theme}-${info.project.name}.png`,fullPage:true});
  await page.getByLabel("PIN perangkat",{exact:true}).fill("654321");
  await expect(page.locator("#pin-unlock-error")).toContainText("PIN tidak sesuai");
  await expect(page.getByLabel("PIN perangkat",{exact:true})).toHaveValue("");
  await page.getByLabel("PIN perangkat",{exact:true}).fill("123456");
  await expect(page.getByRole("heading",{name:/^Halo,/})).toBeVisible();
  await expect(card).toHaveCount(0);
 });
}
test.describe("explicit biometric request",()=>{
 test.use({allowedConsoleErrors:["Failed to load resource: the server responded with a status of 400"]});
 test("requests biometrics only after tapping fingerprint",async({page})=>{
  await lockedDevice(page,"dark");let requests=0;
  await page.route("**/auth/v1/passkeys/authentication/options",route=>{requests++;return route.fulfill({status:400,json:{message:"Biometric verification unavailable"}});});
  await page.goto("/dashboard");await expect(page.getByLabel("PIN perangkat",{exact:true})).toBeVisible();expect(requests).toBe(0);
  await page.getByRole("button",{name:"Buka dengan biometrik",exact:true}).click();
  await expect.poll(()=>requests).toBe(1);await expect(page.locator("#pin-unlock-error")).toBeVisible();
  await expect(page.getByLabel("PIN perangkat",{exact:true})).toBeEnabled();
 });
});
test("Settings requires confirmed PIN before enabling the device lock",async({page})=>{
 await mockReference(page,"dark");await page.route("**/auth/v1/passkeys",route=>route.fulfill({json:[{id:"device-passkey",created_at:"2026-10-14T00:00:00Z"}]}));
 await page.goto("/settings");await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
 await expect(page.getByLabel("PIN perangkat",{exact:true})).toHaveCount(0);
 await page.locator('label').filter({has:page.locator("#biometricToggle")}).click();
 const setup=page.getByRole("dialog",{name:"Buat PIN perangkat",exact:true});await expect(setup).toBeVisible();
 await setup.getByLabel("PIN baru",{exact:true}).fill("123456");await setup.getByLabel("Konfirmasi PIN",{exact:true}).fill("654321");await setup.getByRole("button",{name:"Simpan PIN",exact:true}).click();
 await expect(setup.getByRole("alert")).toContainText("tidak sama");await expect(page.locator("#biometricToggle")).not.toBeChecked();
 await setup.getByLabel("Konfirmasi PIN",{exact:true}).fill("123456");await setup.getByRole("button",{name:"Simpan PIN",exact:true}).click();
 await expect(setup).toHaveCount(0);await expect(page.locator("#biometricToggle")).toBeChecked();
 await page.reload();await expect(page.getByLabel("PIN perangkat",{exact:true})).toBeVisible();
});

test("fingerprint invokes the native credential prompt and cancellation keeps PIN available",async({page})=>{
 await lockedDevice(page,"dark");
 await page.addInitScript(()=>{Object.defineProperty(navigator.credentials,"get",{configurable:true,value:async()=>{document.documentElement.dataset.biometricCalls=String(Number(document.documentElement.dataset.biometricCalls??0)+1);throw new DOMException("Cancelled","NotAllowedError");}});});
 await page.route("**/auth/v1/passkeys/authentication/options",route=>route.fulfill({json:{challenge_id:"test-challenge",options:{challenge:"AQIDBA",rpId:"127.0.0.1",userVerification:"required",timeout:1000}}}));
 await page.goto("/dashboard");await expect(page.getByLabel("PIN perangkat",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Number(document.documentElement.dataset.biometricCalls??0))).toBe(0);
 await page.getByRole("button",{name:"Buka dengan biometrik",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>Number(document.documentElement.dataset.biometricCalls??0))).toBe(1);
 await expect(page.locator("#pin-unlock-error")).toBeVisible();
 await expect(page.getByLabel("PIN perangkat",{exact:true})).toBeEnabled();
});
test.describe("biometric enrollment recovery",()=>{
 test.use({allowedConsoleErrors:["Failed to load resource: the server responded with a status of 400"]});
 test("keeps biometrics off when enrollment fails and clears a cancelled PIN setup",async({page})=>{
  await mockReference(page,"dark");let requests=0;
  await page.route("**/auth/v1/passkeys/registration/options",route=>{requests++;return route.fulfill({status:400,json:{message:"Enrollment unavailable"}});});
  await page.goto("/settings");await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
  await page.locator('label').filter({has:page.locator("#biometricToggle")}).click();
  const setup=page.getByRole("dialog",{name:"Buat PIN perangkat",exact:true});
  await setup.getByLabel("PIN baru",{exact:true}).fill("123456");await setup.getByLabel("Konfirmasi PIN",{exact:true}).fill("123456");await setup.getByRole("button",{name:"Simpan PIN",exact:true}).click();
  const enrollment=page.getByRole("dialog",{name:"Aktifkan biometrik",exact:true});await expect(enrollment).toBeVisible();expect(requests).toBe(0);
  await enrollment.getByRole("button",{name:"Aktifkan biometrik",exact:true}).click();await expect.poll(()=>requests).toBe(1);await expect(enrollment.getByRole("alert")).toBeVisible();
  await expect(page.locator("#biometricToggle")).not.toBeChecked();await enrollment.getByRole("button",{name:"Tutup",exact:true}).click();await expect(enrollment).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),devicePinKey(user.id))).toBeNull();
 });
});
