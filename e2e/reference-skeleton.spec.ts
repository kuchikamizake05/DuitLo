import {test,expect} from "./fixtures";
import {mockReference} from "./reference-fixtures";
for(const theme of ["light","dark"] as const)test(`loading placeholders follow ${theme} palette`,async({page})=>{
 await mockReference(page,theme);await page.emulateMedia({reducedMotion:"reduce"});let hold=true;const pending:Array<()=>void>=[];
 await page.route("https://e2e-project.supabase.co/**",async route=>{if(hold)await new Promise<void>(resolve=>pending.push(resolve));await route.fallback();});
 try{for(const path of ["/dashboard","/accounts","/transactions","/insights","/investments","/settings","/planning","/goals","/reports","/trading","/journey"]){
 hold=true;await page.goto(path);const skeleton=page.locator("main .ft-skeleton").first();await expect(skeleton).toBeVisible();await expect(skeleton.locator(".ft-skeleton-card").first()).toHaveCSS("background-color",theme==="dark"?"rgb(32, 32, 36)":"rgb(255, 255, 255)");await expect(skeleton.locator(".ft-skeleton-line").first()).toHaveCSS("animation-name","none");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 hold=false;pending.splice(0).forEach(resolve=>resolve());await expect(page.locator("main .ft-skeleton")).toHaveCount(0);await page.waitForLoadState("networkidle");
 }}finally{hold=false;pending.splice(0).forEach(resolve=>resolve());}
});
