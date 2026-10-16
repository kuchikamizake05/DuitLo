import { expect, mockSupabase, test } from "./fixtures";

const routes = [
  ["/dashboard", /^Halo, FinTrack/],
  ["/transactions", "Aktivitas"],
  ["/accounts", "Dompet"],
  ["/investments", "Investasi"],
  ["/trading", "Trading"],
  ["/planning", "Kelola Anggaran"],
  ["/settings", "Pengaturan"],
  ["/insights", "Laporan"],
] as const;

test.describe("authenticated application routes render with controlled read-only data @smoke", () => {
  for (const [route, heading] of routes) {
    test(`${route} renders`, async ({ page }) => {
      await mockSupabase(page, true);
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });
  }
});
