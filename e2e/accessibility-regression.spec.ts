import { fulfillPostgrestRows as fulfillRows } from "./postgrest-response";
import type { Page } from "@playwright/test";
import { expect, mockAuthenticatedSession, mockSupabase, test, user } from "./fixtures";

const account = {
  id: "account-1",
  name: "BCA Utama",
  institution: "BCA",
  kind: "bank" as const,
  currency: "IDR",
  current_balance: 1_000_000,
  reporting_balance_idr: null,
  is_active: true,
  updated_at: "2026-08-12T00:00:00.000Z",
};

const transaction = {
  id: "transaction-1",
  date: "2026-08-10",
  type: "expense" as const,
  merchant: "Belanja bulanan",
  category: "Kebutuhan",
  amount: 125_000,
  note: null,
  source: "manual",
  receipt_url: null,
  ai_confidence: null,
  status: "confirmed" as const,
  created_at: "2026-08-10T08:00:00.000Z",
  updated_at: "2026-08-10T08:00:00.000Z",
  account_id: account.id,
};

const category = {
  id: "category-1",
  user_id: user.id,
  name: "Kebutuhan",
  type: "expense" as const,
  icon: "ShoppingBag",
  color: "#166534",
  created_at: "2026-01-01T00:00:00.000Z",
};


async function mockTransactionsPage(page: Page) {
  let deleteRequests = 0;
  let deleted = false;
  await mockAuthenticatedSession(page);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, [account]);
      return;
    }
    if (url.pathname === "/rest/v1/categories") {
      await fulfillRows(route, [category]);
      return;
    }
    if (url.pathname === "/rest/v1/transactions") {
      if (request.method() === "PATCH") {
        deleteRequests += 1;
        deleted = true;
        await route.fulfill({json:[{id:transaction.id}]});
        return;
      }
      await fulfillRows(route, deleted ? [{ ...transaction, status: "deleted" }] : [transaction]);
      return;
    }
    await fulfillRows(route, []);
  });
  return () => deleteRequests;
}

async function mockAccountsPage(page: Page) {
  await mockAuthenticatedSession(page);
  await page.route("https://e2e-project.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, json: user });
      return;
    }
    if (url.pathname === "/rest/v1/financial_accounts") {
      await fulfillRows(route, [account]);
      return;
    }
    if (url.pathname === "/rest/v1/account_transfers") {
      await fulfillRows(route, [{
        id: "transfer-1",
        source_account_id: account.id,
        destination_account_id: "account-2",
        amount: 100_000,
        destination_amount: 100_000,
        currency: "IDR",
        destination_currency: "IDR",
        date: "2026-08-11",
        note: "Dana darurat",
      }]);
      return;
    }
    if (url.pathname === "/rest/v1/account_reconciliations") {
      await fulfillRows(route, [{
        id: "reconciliation-1",
        account_id: account.id,
        statement_balance: 1_000_000,
        ledger_balance: 990_000,
        reconciled_at: "2026-08-12",
        note: "Cek mutasi",
      }]);
      return;
    }
    await fulfillRows(route, []);
  });
}


test.describe("keyboard and confirmation regressions @critical", () => {
  test("transaction confirmation traps focus, closes safely, and requires explicit delete", async ({ page }) => {
    const getDeleteRequests = await mockTransactionsPage(page);
    await page.goto("/transactions?view=detail&id=transaction-1");

    const deleteButton = page.getByRole("button", { name: "Hapus Transaksi" });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const dialog = page.getByRole("dialog",{name:/Hapus/});
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Sampah");
    for(let index=0;index<5;index++){
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading",{name:"Aktivitas",exact:true})).toBeVisible();
    expect(getDeleteRequests()).toBe(0);

    await page.goto("/transactions?view=detail&id=transaction-1");
    await deleteButton.click();
    await page.getByRole("dialog",{name:/Hapus/}).getByRole("button", { name: /Hapus Transaksi|Ya, Hapus/i }).click();
    await expect(page.getByRole("dialog",{name:/Hapus/})).toBeHidden();
    expect(getDeleteRequests()).toBe(1);
  });

  test("category picker closes with Escape and restores keyboard focus", async ({ page }) => {
    await mockTransactionsPage(page);
    await page.goto("/transactions?new=1");
    const editor=page.getByRole("dialog",{name:"Catat Transaksi",exact:true});
    const trigger=editor.locator('[data-reference-node="catat.70"]');
    await trigger.focus();
    await trigger.click();
    const picker=page.getByRole("dialog",{name:"Pilih Kategori",exact:true});
    await expect(picker.getByRole("button",{name:"Kebutuhan",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("account detail keeps the selected ledger balance scoped", async ({ page }) => {
    await mockAccountsPage(page);
    await page.goto("/accounts?view=detail&id=account-1");
    const detail=page.getByRole("dialog");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("BCA Utama");
    await expect(detail).toContainText("1.000.000");
    await expect(detail.getByRole("button",{name:/Edit transfer|Edit rekonsiliasi/})).toHaveCount(0);
  });

  test("skip link and profile menu support keyboard recovery", async ({ page }) => {
    await mockSupabase(page, true);
    await page.addInitScript(userId => localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused"), user.id);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading",{name:/^Halo,/})).toBeVisible();
    const skipLink = page.getByRole("link", { name: "Lewati ke konten utama" });
    await expect(skipLink).toHaveAttribute("data-ready", "true");
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const profileTrigger = page.getByRole("button",{name:"Profil Akun"});
    await profileTrigger.click();
    await expect(page).toHaveURL(/settings$/);
    await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
  });
});
