import type { Page, Route } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user } from "./fixtures";

const accounts = [
  { id: "idr-bank", name: "BCA Utama", currency: "IDR", current_balance: 1_000_000, updated_at: "2026-08-20T00:00:00.000Z", is_active: true, kind: "bank" },
  { id: "usd-wallet", name: "USD Wallet", currency: "USD", current_balance: 200, updated_at: "2026-08-20T00:00:00.000Z", is_active: true, kind: "ewallet" },
];

const transactions = [
  { id: "confirmed-idr", date: "2026-08-08", type: "expense", merchant: "Supermarket", category: "Kebutuhan", amount: 250_000, note: null, status: "confirmed", account_id: "idr-bank" },
  { id: "review-idr", date: "2026-08-10", type: "expense", merchant: "Belanja review", category: "Kebutuhan", amount: 75_000, note: null, status: "needs_review", account_id: "idr-bank" },
  { id: "confirmed-usd", date: "2026-08-11", type: "expense", merchant: "Cloud", category: "Langganan", amount: 50, note: null, status: "confirmed", account_id: "usd-wallet" },
];

type Goal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; color: null; due_date: string | null; is_active: boolean };

async function fulfillRows(route: Route, rows: unknown[]) {
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
    body: JSON.stringify(rows),
  });
}

async function mockPlanningPage(page: Page, initialGoals: Goal[] = []) {
  const goals: Goal[] = [...initialGoals];
  const importedPayloads: unknown[] = [];
  const archivedGoalIds: string[] = [];
  await mockAuthenticatedSession(page);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, accounts);
      return;
    }
    if (url.pathname === "/rest/v1/transactions") {
      if (request.method() === "POST") {
        importedPayloads.push(request.postDataJSON());
        await fulfillRows(route, []);
        return;
      }
      await fulfillRows(route, transactions);
      return;
    }
    if (url.pathname === "/rest/v1/financial_goals") {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as Omit<Goal, "id" | "color" | "is_active">;
        goals.push({ ...payload, id: "goal-1", color: null, is_active: true });
        await route.fulfill({ status: 201, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" }, body: JSON.stringify([goals[0]]) });
        return;
      }
      if (request.method() === "PATCH") {
        const goalId = url.searchParams.get("id")?.replace("eq.", "");
        if (goalId) archivedGoalIds.push(goalId);
        const goal = goals.find((item) => item.id === goalId);
        if (goal) goal.is_active = false;
        await fulfillRows(route, goal ? [goal] : []);
        return;
      }
      await fulfillRows(route, goals.filter((goal) => goal.is_active));
      return;
    }
    await fulfillRows(route, []);
  });
  return { getImportedPayloads: () => importedPayloads, getArchivedGoalIds: () => archivedGoalIds };
}

test("goal archive stays scoped to the selected goal @critical", async ({ page }) => {
 const state=await mockPlanningPage(page,[{id:"goal-1",name:"Dana darurat",target_amount:12000000,current_amount:3000000,currency:"IDR",color:null,due_date:null,is_active:true}]);
 await page.goto("/goals?view=detail&id=goal-1");
 const detail=page.getByRole("dialog");await expect(detail).toContainText("Dana darurat");
 await detail.getByRole("button",{name:"Arsipkan",exact:true}).click();
 await expect.poll(()=>state.getArchivedGoalIds()).toEqual(["goal-1"]);
});
test("budget usage excludes review transactions and foreign currency @critical", async ({ page }) => {
 await mockPlanningPage(page);
 await page.clock.setFixedTime(new Date("2026-08-20T08:00:00Z"));
 await page.route("**/rest/v1/financial_budgets**",route=>route.fulfill({json:[{id:"budget-1",month:"2026-08-01",category:"Kebutuhan",limit_amount:1000000}]}));
 await page.goto("/planning");
 await expect(page.getByRole("heading",{name:"Kelola Anggaran",exact:true})).toBeVisible();
 await expect(page.locator('[data-reference-node="anggaran.79"]').filter({hasText:"Kebutuhan"})).toContainText("250.000");
 await expect(page.getByText("Anggaran dihitung dari transaksi rekening IDR.", {exact:true})).toBeVisible();
});
