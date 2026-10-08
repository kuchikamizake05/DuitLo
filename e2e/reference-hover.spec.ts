import {test,expect} from "./fixtures";
import {mockReference} from "./reference-fixtures";
for(const theme of ["light","dark"] as const)test(`primary card hover matches HTML in ${theme}`,async({page,context,isMobile})=>{
 test.skip(isMobile,"Touch devices do not expose pointer hover.");
 test.setTimeout(90000);await mockReference(page,theme);const source=await context.newPage();let checked=0;
 for(const [name,path] of [["beranda","/dashboard"],["dompet","/accounts"],["aktivitas","/transactions"],["laporan","/insights"],["anggaran","/planning"],["target","/goals"],["portofolio","/investments"],["pengaturan","/settings"]]){
  await page.goto(path);await expect(page.locator("main")).toBeVisible();await source.goto(`http://127.0.0.1:8743/${theme==="dark"?"fintrack-dark/":""}fintrack-${name}-reference.html`);
  await page.addStyleTag({content:"*{transition:none!important}"});await source.addStyleTag({content:"*{transition:none!important}"});
  const nodes=await source.evaluate(()=>[...document.body.querySelectorAll("*")].flatMap((el,index)=>el.matches("div,section,a")&&el.className.toString().includes("hover:shadow")&&el.getBoundingClientRect().height>55?[index]:[]));
  for(const index of nodes){const actual=page.locator(`[data-reference-node="${name}.${index}"]`).first();if(!await actual.count()||!await actual.isVisible())continue;const original=source.locator("body *").nth(index);await original.hover();await actual.hover();const styles=(el:Element)=>{const s=getComputedStyle(el);return {background:s.backgroundColor,image:s.backgroundImage,radius:s.borderRadius,shadow:s.boxShadow.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px,?\s*/g,"")};};await expect.poll(async()=>actual.evaluate(styles)).toEqual(await original.evaluate(styles));checked++;}
 }
 await source.close();expect(checked).toBeGreaterThan(0);
});
