import { fulfillPostgrestRows as fulfillRows } from "./postgrest-response";
import type { Page } from "@playwright/test";
import { expect, mockAuthenticatedSession, test, user } from "./fixtures";

const account = {
  id: "account-1",
  name: "BCA Utama",
  currency: "IDR",
};

const category = {
  id: "category-income",
  user_id: user.id,
  name: "Pemasukan lain",
  type: "income" as const,
  icon: "Wallet",
  color: "#166534",
  created_at: "2026-01-01T00:00:00.000Z",
};

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  source: "manual";
  status: "confirmed" | "needs_review";
  account_id: string;
  receipt_url: null;
  ai_confidence: null;
  raw_text: null;
  created_at: string;
  updated_at: string;
};


async function mockTransactionScanPage(page: Page, options: { parserStatus?: number } = {}) {
  const transactions: Transaction[] = [];
  const transactionPayloads: unknown[] = [];
  let parserRequests = 0;

  await mockAuthenticatedSession(page);
  await page.addInitScript(userId => localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused"), user.id);
  await page.route("**/api/receipts/parse", async (route) => {
    parserRequests += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
    if (options.parserStatus) {
      await route.fulfill({ status: options.parserStatus, json: { error: "AI belum bisa menganalisis struk. Silakan isi form manual." } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        extraction: {
          date: "2026-08-22",
          merchant: "Transfer Gaji",
          amount: 7500000,
          categoryHint: "Pemasukan lain",
          type: "income",
          proofKind: "transfer",
          note: "Gaji Agustus",
          rawText: null,
          confidence: null,
        },
      },
    });
  });
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
      if (request.method() === "POST") {
        const payload = (request.postDataJSON() as Array<Omit<Transaction, "id" | "receipt_url" | "ai_confidence" | "raw_text" | "created_at" | "updated_at">>)[0];
        transactionPayloads.push(payload);
        transactions.unshift({
          ...payload,
          id: "scan-transaction-1",
          receipt_url: null,
          ai_confidence: null,
          raw_text: null,
          created_at: "2026-08-22T08:00:00.000Z",
          updated_at: "2026-08-22T08:00:00.000Z",
        });
        await fulfillRows(route, [transactions[0]]);
        return;
      }
      if (request.method() === "PATCH") {
        const payload = request.postDataJSON() as Partial<Transaction>;
        transactionPayloads.push(payload);
        const current = transactions[0];
        if (current) Object.assign(current, payload);
        await fulfillRows(route, current ? [current] : []);
        return;
      }
      await fulfillRows(route, transactions);
      return;
    }
    await fulfillRows(route, []);
  });

  return { getParserRequests: () => parserRequests, getTransactionPayloads: () => transactionPayloads };
}

test.describe("receipt scan review flow @critical",()=>{
 test.describe("dark mode AI outage",()=>{
  test.use({allowedConsoleErrors:["Failed to load resource: the server responded with a status of 503"]});
  for (const source of ["camera","gallery"] as const) {
   test(`keeps ${source} failures in the picker without a transaction result`,async({page})=>{
    const state=await mockTransactionScanPage(page,{parserStatus:503});
    await page.addInitScript(()=>{
     localStorage.setItem("fintrack-theme","dark");
     localStorage.setItem("fintrack-language","id");
    });
    await page.goto("/transactions");
    await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();
    await page.getByRole("button",{name:"Foto struk",exact:true}).click();
    const picker=page.getByRole("dialog",{name:"Foto struk",exact:true});
    const input=source==="camera"?'input[type="file"][capture]':'input[type="file"]:not([capture])';
    await page.locator(input).first().setInputFiles({name:"receipt.png",mimeType:"image/png",buffer:Buffer.from("fake image")});
    await expect(picker.getByRole("alert")).toContainText("AI belum bisa");
    await expect(picker.getByRole("button",{name:"Galeri",exact:true})).toBeEnabled();
    await expect(page.getByRole("dialog",{name:"Hasil Transaksi",exact:true})).toHaveCount(0);
    await expect(page).toHaveURL(/\/transactions$/);
    expect(state.getTransactionPayloads()).toHaveLength(0);
    expect(state.getParserRequests()).toBe(1);
    await picker.getByRole("button",{name:"Tutup",exact:true}).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole("dialog",{name:"Hasil Transaksi",exact:true})).toHaveCount(0);
   });
  }
 });
 test.describe("English parse error",()=>{
  test.use({allowedConsoleErrors:["Failed to load resource: the server responded with a status of 422"]});
  test("keeps the source picker open and exposes parsing errors",async({page})=>{
   const state=await mockTransactionScanPage(page,{parserStatus:422});
   await page.addInitScript(()=>localStorage.setItem("fintrack-language","en"));
   await page.goto("/transactions");
   await page.getByRole("link",{name:"New transaction",exact:true}).click();
   await page.getByRole("button",{name:"Receipt photo",exact:true}).click();
   const picker=page.getByRole("dialog",{name:"Receipt photo",exact:true});
   await expect(picker).toBeVisible();
   await page.locator('input[type="file"]:not([capture])').first().setInputFiles({name:"broken.png",mimeType:"image/png",buffer:Buffer.from("fake image")});
   await expect(picker.getByRole("alert")).toBeVisible();
   await expect(picker.getByRole("button",{name:"Gallery",exact:true})).toBeEnabled();
   expect(state.getParserRequests()).toBe(1);
  });
 });
 test("fills receipt data and requires review before approval",async({page})=>{
  const state=await mockTransactionScanPage(page);
  await page.clock.setFixedTime(new Date("2026-08-22T08:00:00Z"));
  await page.goto("/transactions");
  await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();
  await page.getByRole("button",{name:"Foto struk",exact:true}).click();
  await page.locator('input[type="file"]:not([capture])').first().setInputFiles({name:"transfer.png",mimeType:"image/png",buffer:Buffer.from("fake image")});
  const editor=page.getByRole("dialog",{name:"Catat Transaksi",exact:true});
  await expect(editor.locator("#merchant-input")).toHaveValue("Transfer Gaji");
  await expect(editor.locator("#nominal-input")).toHaveValue("7.500.000");
  await expect(editor.getByRole("button",{name:"Pemasukan",exact:true})).toHaveAttribute("aria-pressed","true");
  expect(state.getParserRequests()).toBe(1);
  expect(state.getTransactionPayloads()).toHaveLength(0);
  await editor.locator('[data-reference-node="catat.54"]').click();
  await page.getByRole("dialog",{name:"Pilih Rekening",exact:true}).getByRole("button",{name:/BCA Utama/}).click();
  await page.locator('[data-reference-node="pilih-rekening.136"]').click();
  await editor.getByRole("button",{name:"Simpan Transaksi",exact:true}).click();
  await expect.poll(()=>state.getTransactionPayloads().length).toBe(1);
  const payload=state.getTransactionPayloads()[0] as Record<string,unknown>;
  expect(payload).toMatchObject({status:"needs_review",source:"manual",merchant:"Transfer Gaji",type:"income"});
  expect(JSON.stringify(payload)).not.toMatch(/rawText|confidence|receipt_url|image|transfer\.png/i);
  await expect(editor).toBeHidden();
  await page.goto("/transactions?view=detail&id=scan-transaction-1");
  await page.getByRole("button",{name:"Setujui",exact:true}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Setujui transaksi",exact:true}).click();
  await expect.poll(()=>state.getTransactionPayloads()).toContainEqual({status:"confirmed"});
 });
});
