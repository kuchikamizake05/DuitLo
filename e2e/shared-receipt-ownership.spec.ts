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

test("a pre-login receipt is claimed once and remains readable after reload", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(userId => localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused"), user.id);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const cache = await caches.open("fintrack-shared-receipts-v2");
    await cache.put("/__shared-receipts/unclaimed/metadata", new Response(JSON.stringify({ title: "Claimed merchant", text: "Owner note", url: "", fileName: null, fileType: null, ownerId: null, createdAt: Date.now(), expiresAt: Date.now() + 86400000 })));
  });
  await page.goto("/shared-receipt?id=unclaimed");
  await expect(page.getByLabel("Merchant / penerima")).toHaveValue("Claimed merchant");
  const claimedOwner = await page.evaluate(async () => (await (await (await caches.open("fintrack-shared-receipts-v2")).match("/__shared-receipts/unclaimed/metadata"))?.json())?.ownerId);
  expect(claimedOwner).toBe(user.id);
  await page.reload();
  await expect(page.getByLabel("Merchant / penerima")).toHaveValue("Claimed merchant");
});

test("an expired receipt is removed before exposing merchant or file", async ({ page }) => {
  await mockReference(page, "light");
  await page.addInitScript(userId => localStorage.setItem(`fintrack:menu-guide:${userId}:mode`, "paused"), user.id);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.evaluate(ownerId => {
    return caches.open("fintrack-shared-receipts-v2").then(async cache => {
      await cache.put("/__shared-receipts/expired/metadata", new Response(JSON.stringify({ title: "Expired private merchant", text: "", url: "", fileName: null, fileType: null, ownerId, createdAt: Date.now() - 86400001, expiresAt: Date.now() - 1 })));
      await cache.put("/__shared-receipts/expired/file", new Response("expired pixels"));
    });
  }, user.id);
  await page.goto("/shared-receipt?id=expired");
  await expect(page.getByRole("alert").filter({ hasText: "Bukti share tidak ditemukan" })).toBeVisible();
  await expect(page.getByLabel("Merchant / penerima")).toHaveCount(0);
  expect(await page.evaluate(async () => Boolean(await (await caches.open("fintrack-shared-receipts-v2")).match("/__shared-receipts/expired/file")))).toBe(false);
});
