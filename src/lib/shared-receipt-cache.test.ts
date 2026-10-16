import { describe, expect, it } from "vitest";
import { claimSharedReceipt, purgeSharedReceipts, clearPendingFinancialDrafts, SHARED_RECEIPT_TTL } from "./shared-receipt-cache";

function cacheFixture() {
  const records = new Map<string, Response>();
  return {
    records,
    match: async (key: string) => records.get(key)?.clone(),
    put: async (key: string, response: Response) => { records.set(key, response); },
    delete: async (key: string) => records.delete(key),
    keys: async () => [...records.keys()].map(key => new Request(`https://app.test${key}`)),
  };
}
async function seed(cache: ReturnType<typeof cacheFixture>, ownerId: string | null = null, createdAt = 1000) {
  await cache.put("/__shared-receipts/share/metadata", new Response(JSON.stringify({ title: "Private merchant", text: "", url: "", fileName: "receipt.png", fileType: "image/png", ownerId, createdAt, expiresAt: createdAt + SHARED_RECEIPT_TTL })));
  await cache.put("/__shared-receipts/share/file", new Response("private pixels"));
}
describe("shared receipt ownership", () => {
  it("claims a pre-login share once and denies another owner", async () => {
    const cache = cacheFixture(); await seed(cache);
    expect(await claimSharedReceipt(cache, "share", "A", 2000)).toMatchObject({ ownerId: "A" });
    expect(await claimSharedReceipt(cache, "share", "B", 2000)).toBeNull();
    expect(await claimSharedReceipt(cache, "share", "A", 2000)).toMatchObject({ title: "Private merchant" });
  });
  it("does not expose metadata without authentication", async () => {
    const cache = cacheFixture(); await seed(cache);
    expect(await claimSharedReceipt(cache, "share", null, 2000)).toBeNull();
  });
  it("expires and removes metadata and file together", async () => {
    const cache = cacheFixture(); await seed(cache);
    expect(await claimSharedReceipt(cache, "share", "A", 1000 + SHARED_RECEIPT_TTL)).toBeNull();
    expect(cache.records.size).toBe(0);
  });
  it("removes outgoing-owner and legacy unclaimed shares on logout", async () => {
    const cache = cacheFixture(); await seed(cache, "A");
    await purgeSharedReceipts(cache, "A");
    expect(cache.records.size).toBe(0);
  });
  it("retains a valid owner claim until confirmed saving so retry after reload works", async () => {
    const cache = cacheFixture(); await seed(cache, "A");
    expect(await claimSharedReceipt(cache, "share", "A", 2000)).not.toBeNull();
    expect(await claimSharedReceipt(cache, "share", "A", 3000)).not.toBeNull();
    expect(cache.records.size).toBe(2);
  });
  it("denies legacy metadata without ownership lifetime", async () => {
    const cache = cacheFixture();
    await cache.put("/__shared-receipts/share/metadata", new Response(JSON.stringify({ title: "Legacy private data" })));
    expect(await claimSharedReceipt(cache, "share", "B", 2000)).toBeNull();
    expect(cache.records.size).toBe(0);
  });
  it("does not purge another owner's valid offline share", async () => {
    const cache = cacheFixture(); await seed(cache, "B");
    await purgeSharedReceipts(cache, "A");
    expect(cache.records.size).toBe(2);
  });
  it("purges outgoing and orphaned save attempts while retaining another owner's draft", () => {
    const data = new Map([
      ["fintrack:pending-save:v1:A:manual", JSON.stringify({ payload: { user_id: "A" } })],
      ["fintrack:pending-save:v1:B:manual", JSON.stringify({ payload: { user_id: "B" } })],
      ["fintrack:pending-save:v1:orphan", "{}"],
      ["fintrack:theme", "dark"],
    ]);
    const store = { get length() { return data.size; }, key: (index: number) => [...data.keys()][index] ?? null, getItem: (key: string) => data.get(key) ?? null, removeItem: (key: string) => { data.delete(key); } };
    clearPendingFinancialDrafts(store, "A");
    expect([...data.keys()]).toEqual(["fintrack:pending-save:v1:B:manual", "fintrack:theme"]);
  });
});
