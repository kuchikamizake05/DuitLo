import {test,expect} from "./fixtures";
import {mockReference} from "./reference-fixtures";
for (const theme of ["light","dark"] as const) test(`application palette and browser bar stay consistent in ${theme}`, async ({page})=>{
 await mockReference(page,theme);
 for(const path of ["/dashboard","/accounts","/transactions","/insights","/planning","/goals","/investments"]){
  await page.goto(path);
  await expect(page.getByRole("main").filter({hasNot:page.locator(".ft-skeleton")})).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme",theme);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content",theme==="dark"?"#111214":"#f4fbf6");
  await expect(page.locator("body")).toHaveCSS("background-color",theme==="dark"?"rgb(17, 18, 20)":"rgb(244, 251, 246)");
 }
 await page.reload();
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content",theme==="dark"?"#111214":"#f4fbf6");
});
