import { fulfillPostgrestRows } from "./postgrest-response";
import { test, expect, user } from "./fixtures";
import { mockReference, account, transaction } from "./reference-fixtures";
import type { Page } from "@playwright/test";

async function emptyData(page: Page, withAccount = false, tutorial = false) {
  await mockReference(page, "light");
  if (!tutorial) await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
  await page.route("https://e2e-project.supabase.co/rest/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    return fulfillPostgrestRows(route, path.endsWith("financial_accounts") && withAccount ? [account] : []);
  });
}

test("new user follows highlighted controls to the wallet form", async ({ page }, testInfo) => {
  await emptyData(page, false, true);
  await page.goto("/dashboard");
  await expect(page.getByRole("complementary", { name: "Panduan langkah pertama" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beranda" })).toBeVisible();
  await expect(page.getByText("Ringkasan Analisis Finansial Siap")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Transaksi Terbaru",exact:true})).toBeVisible();
  await expect(page.getByRole("region", { name: "Selesaikan penyiapan DuitLo" })).toHaveCount(0);
  await expect.poll(() => page.getByRole("complementary", { name: "Panduan langkah pertama" }).locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("empty-dashboard.png"), fullPage: true });
  await page.getByRole("complementary").getByRole("button",{name:"Lanjut",exact:true}).click();
  const add = page.locator('[data-guide="add-wallet"]');
  await expect(add).toHaveClass(/ft-guide-target/);
  await add.click();
  await expect(page.getByRole("dialog", { name: "Tambah Rekening Baru", exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Panduan langkah pertama" })).toHaveCount(0);
});

test("guide can be skipped and stays dismissed on reload", async ({ page }) => {
  await emptyData(page, false, true);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Lewati", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Panduan langkah pertama" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Halo/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Panduan langkah pertama" })).toHaveCount(0);
});

test("guide advances after saving a wallet and ends after saving a transaction", async ({ page }) => {
  await mockReference(page, "light");
  let walletSaved = false;
  let transactionSaved = false;
  await page.route("https://e2e-project.supabase.co/rest/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("financial_accounts")) {
      if (route.request().method() === "POST") {
        walletSaved = true;
        return route.fulfill({ json: account });
      }
      return fulfillPostgrestRows(route, walletSaved ? [account] : []);
    }
    if (path.endsWith("transactions")) {
      if (route.request().method() === "POST") transactionSaved = true;
      return fulfillPostgrestRows(route, transactionSaved ? [transaction] : []);
    }
    return route.fulfill({ json: path.endsWith("categories") ? [{ name: "Makanan & Minuman", type: "expense" }] : [] });
  });
  await page.goto("/dashboard");
  await page.getByRole("complementary").getByRole("button",{name:"Lanjut",exact:true}).click();
  await page.locator('[data-guide="add-wallet"]').click();
  await page.locator("#custom-name-input").fill("Dompet pertama");
  await page.getByRole("button", { name: "Simpan Akun", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catat",exact:true })).toBeVisible();
  await page.locator('nav a[href="/transactions?new=1"].ft-guide-target').click();
  await page.getByRole("button", { name: "Catat manual", exact: true }).click();
  await page.locator("#nominal-input").fill("10000");
  await page.locator("#desc-input").fill("Makan siang");
  await page.getByRole("button", { name: "Pilih kategori", exact: true }).click();
  await page.getByRole("button", { name: /Makanan & Minuman/ }).click();
  await page.getByRole("button", { name: "Simpan Transaksi", exact: true }).click();
  await expect.poll(() => transactionSaved).toBe(true);
  await expect(page.getByRole("complementary", { name: "Panduan langkah pertama" })).toHaveCount(0);
});

test("empty activity guides users without accounts to add a wallet", async ({ page }) => {
  await emptyData(page);
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Belum ada transaksi", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tambah Dompet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hari Ini", exact: true })).toHaveCount(0);
});

test("empty filter results do not label existing users as new", async ({ page }) => {
  await mockReference(page, "light");
  await page.goto("/transactions");
  await page.locator('[data-reference-node="aktivitas.166"]').click();
  await expect(page.getByRole("heading", { name: "Tidak ada transaksi pada pilihan ini" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Isi Bensin Pertamax/ })).toBeVisible();
});

test("account without transactions uses a period-aware action", async ({ page }) => {
  await emptyData(page, true);
  await page.goto("/dashboard");
  await expect(page.getByText("Belum ada transaksi",{exact:true})).toBeVisible();
  await expect(page.getByText("Ringkasan Analisis Finansial Siap")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Transaksi Terbaru",exact:true})).toBeVisible();
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Belum ada laporan untuk periode ini" })).toBeVisible();
  await expect(page.getByLabel("Periode", { exact: true })).toBeVisible();
});

test("budget and goal empty states offer creation without progress claims", async ({ page }) => {
  await emptyData(page);
  await page.goto("/planning");
  await expect(page.getByRole("heading", { name: "Rencanakan pengeluaran bulan ini" })).toBeVisible();
  await expect(page.getByText("Rasio Stabil", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Tambah anggaran", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Tambah anggaran", exact: true })).toBeVisible();
  await page.goto("/goals");
  await expect(page.getByRole("heading", { name: "Apa yang ingin kamu wujudkan?" })).toBeVisible();
  await page.getByRole("button", { name: "Tambah Target Tabungan", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Mulai Target Tabungan", exact: true })).toBeVisible();
});

test("English new-user guide highlights wallets and opens add account", async ({page}) => {
  await emptyData(page,false,true);
  await page.addInitScript(() => localStorage.setItem("fintrack-language","en"));
  await page.goto("/dashboard");
  await page.getByRole("complementary").getByRole("button",{name:"Next",exact:true}).click();
  await expect(page.locator('aside[aria-live="polite"]')).toBeVisible();
  await expect(page.locator('[data-guide="add-wallet"]')).toHaveClass(/ft-guide-target/);
});
