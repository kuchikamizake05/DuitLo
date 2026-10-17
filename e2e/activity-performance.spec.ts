import { test, expect } from "./fixtures";
import { mockReference, transaction } from "./reference-fixtures";
import { fulfillPostgrestRows } from "./postgrest-response";
import { readFile } from "node:fs/promises";

test("activity fetches calendar months and keeps its month selector mounted during refresh", async ({ page }) => {
  await mockReference(page, "dark");
  const periods: string[][] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/transactions?**", async route => {
    const dates = new URL(route.request().url()).searchParams.getAll("date");
    periods.push(dates);
    if (dates.includes("gte.2026-09-01")) await gate;
    await route.fallback();
  });
  try {
    await page.goto("/transactions?date=2026-10-16");
    await expect(page.locator("main[aria-busy='false']")).toBeVisible();
    expect(periods.some(dates => dates.includes("gte.2026-10-01") && dates.includes("lte.2026-10-31"))).toBe(true);
    await page.getByRole("button", { name: "Periode sebelumnya", exact: true }).click();
    await expect.poll(() => periods.some(dates => dates.includes("gte.2026-09-01") && dates.includes("lte.2026-09-30"))).toBe(true);
    await expect(page.locator("main[aria-busy='true']")).toBeVisible();
    await expect(page.locator("main .ft-skeleton")).toHaveCount(0);
    await expect(page.locator("#monthDropdownBtn")).toContainText("Sep 2026");
    release();
    await expect(page.locator("main[aria-busy='false']")).toBeVisible();
    await expect(page.locator("#monthDropdownBtn")).toContainText("Sep 2026");
  } finally { release(); }
});

test("returning to activity shows the account's cached data while revalidating", async ({ page }) => {
  await mockReference(page, "light");
  let delayed = false;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/transactions?**", async route => {
    if (delayed && !new URL(route.request().url()).searchParams.has("status")) await gate;
    await route.fallback();
  });
  try {
    await page.goto("/transactions?date=2026-10-12");
    await expect(page.locator("main[aria-busy='false']")).toBeVisible();
    await page.locator('nav a[href="/dashboard"]').click();
    await expect(page.getByRole("heading", { name: /Halo/ })).toBeVisible();
    delayed = true;
    await page.locator('nav a[href="/transactions"]').click();
    await expect(page.locator("main[aria-busy='true']")).toBeVisible();
    await expect(page.locator("main .ft-skeleton")).toHaveCount(0);
    await expect(page.locator("main").getByText("Isi Bensin Pertamax", { exact: true })).toBeVisible();
    release();
    await expect(page.locator("main[aria-busy='false']")).toBeVisible();
  } finally { release(); }
});

test("long activity days render progressively while keeping the full export", async ({ page }, testInfo) => {
  await mockReference(page, "dark");
  const rows = Array.from({ length: 121 }, (_, index) => ({ ...transaction, id: `row-${index}`, amount: 10000 }));
  await page.route("**/rest/v1/transactions?**", route => fulfillPostgrestRows(route, rows));
  await page.goto("/transactions?date=2026-10-12");
  const cards = page.locator('main button[data-reference-node="aktivitas.180"]');
  await expect(cards).toHaveCount(60);
  await page.getByRole("button", { name: "Unduh", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel / CSV", exact: true }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath("activity.csv");
  await download.saveAs(path);
  expect((await readFile(path, "utf8")).trim().split(/\r?\n/)).toHaveLength(122);
  await page.getByRole("button", { name: "Tampilkan lebih banyak", exact: true }).click();
  await expect(cards).toHaveCount(120);
  await page.getByRole("button", { name: "Tampilkan lebih banyak", exact: true }).click();
  await expect(cards).toHaveCount(121);
  await expect(page.getByRole("button", { name: "Tampilkan lebih banyak", exact: true })).toHaveCount(0);
});

test("reports only render the selected chart", async ({ page }) => {
  await mockReference(page, "dark");
  await page.goto("/insights");
  await expect(page.locator("#report-donut-chart")).toBeVisible();
  await expect(page.locator("#report-bar-chart")).toHaveCount(0);
  await page.locator("#view-bar").click();
  await expect(page.locator("#report-bar-chart")).toBeVisible();
  await expect(page.locator("#report-donut-chart")).toHaveCount(0);
  await page.locator("#view-donut").click();
  await expect(page.locator("#report-donut-chart")).toBeVisible();
  await expect(page.locator("#report-bar-chart")).toHaveCount(0);
});
