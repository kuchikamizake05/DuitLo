import {expect,test,mockSupabase,user} from "./fixtures";

test("settings waits for initial eligibility and stays mounted during a later refresh",async({page})=>{
 await mockSupabase(page,true);
 await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
 let passkeyRequests=0;
 let releaseEligibility!:()=>void;
 let eligibilityReady=new Promise<void>(resolve=>{releaseEligibility=resolve;});
 let eligibilityRequests=0;
 await page.route("**/rest/v1/financial_accounts**",async route=>{
  if(new URL(route.request().url()).searchParams.get("select")==="id"){
   eligibilityRequests++;
   await eligibilityReady;
  }
  await route.fallback();
 });
 await page.route("**/auth/v1/passkeys",async route=>{
  if(route.request().method()==="GET")passkeyRequests++;
  await route.fallback();
 });
 const eligibilityResponse=()=>page.waitForResponse(response=>response.url().includes("/rest/v1/financial_accounts")&&new URL(response.url()).searchParams.get("select")==="id");
 await page.goto("/settings");
 await expect.poll(()=>eligibilityRequests).toBeGreaterThan(0);
 await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toHaveCount(0);
 await expect(page.getByRole("status",{name:"Memuat data",exact:true})).toBeVisible();
 expect(passkeyRequests).toBe(0);
 const initialResponse=eligibilityResponse();releaseEligibility();await initialResponse;
 const heading=page.getByRole("heading",{name:"Pengaturan",exact:true});
 await expect(heading).toBeVisible();await expect.poll(()=>passkeyRequests).toBe(1);
 await page.evaluate(()=>{
  const heading=[...document.querySelectorAll("h1,h2")].find(node=>node.textContent==="Pengaturan")!;
  const state={removed:false};
  Object.assign(window,{settingsMountState:state});
  new MutationObserver(()=>{if(!heading.isConnected)state.removed=true;}).observe(document.body,{childList:true,subtree:true});
 });
 const previousRequests=eligibilityRequests;
 eligibilityReady=new Promise<void>(resolve=>{releaseEligibility=resolve;});
 await page.evaluate(()=>window.dispatchEvent(new Event("fintrack:setup-data-saved")));
 await expect.poll(()=>eligibilityRequests).toBeGreaterThan(previousRequests);
 await expect(heading).toBeVisible();expect(passkeyRequests).toBe(1);
 const refreshResponse=eligibilityResponse();releaseEligibility();await refreshResponse;
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await expect(heading).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,"settingsMountState").removed)).toBe(false);
 expect(passkeyRequests).toBe(1);
});
