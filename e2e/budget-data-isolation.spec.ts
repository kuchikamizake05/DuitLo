import { test, expect, user } from "./fixtures";
import { mockReference } from "./reference-fixtures";

test("budget page does not depend on unrelated financial tables", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(userId => {
    localStorage.setItem("fintrack-language", "en");
    localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused");
  }, user.id);
  const unrelatedRequests: string[] = [];
  await page.route(/\/rest\/v1\/(financial_goals|recurring_transactions|account_reconciliations)(\?|$)/, async route => {
    unrelatedRequests.push(new URL(route.request().url()).pathname);
    await route.abort("failed");
  });
  await page.route("**/rest/v1/financial_budgets**", route => route.fulfill({ json: [
    { id: "budget-one", category: "Transportasi", limit_amount: 1000000, month: "2026-10-01" },
  ] }));
  await page.clock.setFixedTime(new Date("2026-10-13T05:00:00Z"));
  await page.goto("/planning");
  await expect(page.locator('[data-reference-node="anggaran.85"]')).toHaveText("Transportasi");
  expect(unrelatedRequests).toEqual([]);
});
