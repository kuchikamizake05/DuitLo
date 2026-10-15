import { test, expect, user } from "./fixtures";
import { mockReference } from "./reference-fixtures";

test("clearing a crop input retains a valid preview and saved draft", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(userId => localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused"), user.id);
  await page.route("**/api/local/logo-editor**", route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("variant")) return route.fulfill({ contentType: "image/svg+xml", body: '<svg viewBox="0 0 100 100"><path d="M0 0H100V100H0Z"/></svg>' });
    return route.fulfill({ json: { variants: [{ slug: "bca", name: "Bank BCA", category: "bank-logo", viewBox: [0, 0, 100, 100] }], overrides: {} } });
  });
  await page.goto("/design/logo-editor");
  await expect(page.getByRole("img", { name: "Pratinjau Bank BCA", exact: true })).toBeVisible();
  const width = page.getByRole("spinbutton", { name: "Crop width", exact: true });
  await width.fill("35");
  await expect(width).toHaveValue("35");
  await width.fill("");
  await expect(width).toHaveValue("35");
  await expect(page.getByRole("img", { name: "Pratinjau Bank BCA", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fintrack:logo-editor:draft:bca") ?? "null")?.crop.width)).toBe(.35);
});
