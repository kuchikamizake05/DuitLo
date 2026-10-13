import {expect,test,mockSupabase} from "./fixtures";

test("settings stays mounted when onboarding eligibility resolves",async({page})=>{
 await mockSupabase(page,true);
 let passkeyRequests=0;
 let releaseEligibility!:()=>void;
 const eligibilityReady=new Promise<void>(resolve=>{releaseEligibility=resolve;});
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
 await page.goto("/settings");
 await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
 await expect.poll(()=>eligibilityRequests).toBeGreaterThan(0);
 expect(passkeyRequests).toBe(1);
 await page.evaluate(()=>{
  const heading=[...document.querySelectorAll("h1,h2")].find(node=>node.textContent==="Pengaturan")!;
  const state={removed:false};
  Object.assign(window,{settingsMountState:state});
  new MutationObserver(()=>{if(!heading.isConnected)state.removed=true;}).observe(document.body,{childList:true,subtree:true});
 });
 releaseEligibility();
 await page.waitForResponse(response=>response.url().includes("/rest/v1/financial_accounts")&&new URL(response.url()).searchParams.get("select")==="id");
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,"settingsMountState").removed)).toBe(false);
 expect(passkeyRequests).toBe(1);
});
