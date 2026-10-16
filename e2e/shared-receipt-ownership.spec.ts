import { test, expect, user } from "./fixtures";
import { mockReference } from "./reference-fixtures";

test("a signed-in user cannot open another owner's cached receipt", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(userId => localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused"), user.id);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const metadata = { title: "Other owner private merchant", text: "Private note", url: "", fileName: "private.png", fileType: "image/png", ownerId: "different-owner", createdAt: Date.now(), expiresAt: Date.now() + 86400000 };
    for (const name of ["fintrack-shared-receipts-v1", "fintrack-shared-receipts-v2"]) {
      const cache = await caches.open(name);
      await cache.put("/__shared-receipts/other-owner/metadata", new Response(JSON.stringify(metadata)));
      await cache.put("/__shared-receipts/other-owner/file", new Response("private image"));
    }
  });
  await page.goto("/shared-receipt?id=other-owner");
  await expect(page.getByRole("alert").filter({ hasText: "Bukti share tidak ditemukan" })).toBeVisible();
  await expect(page.getByLabel("Merchant / penerima")).toHaveCount(0);
  await expect(page.getByText("private.png", { exact: true })).toHaveCount(0);
});
