import { afterEach, describe, expect, it, vi } from "vitest";
import { claimSharedReceipt, purgeSharedReceipts, clearPendingFinancialDrafts, clearPrivateReceiptState, withReceiptLock, SHARED_RECEIPT_TTL } from "./shared-receipt-cache";
import { readTransactionAttempt } from "./transaction-attempt";
afterEach(() => vi.unstubAllGlobals());

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
  it("requires a cross-tab claim lock and uses it when supported", async () => {
    vi.stubGlobal("navigator", {});
    await expect(withReceiptLock("share", async () => "private")).rejects.toThrow("aman");
    const request = vi.fn(async (_name: string, action: () => Promise<string>) => action());
    vi.stubGlobal("navigator", { locks: { request } });
    expect(await withReceiptLock("share", async () => "private")).toBe("private");
    expect(request).toHaveBeenCalledWith("fintrack:receipt:share", expect.any(Function));
  });
  it("clears legacy caches and outgoing current cache on explicit logout", async () => {
    const cache = cacheFixture(); await seed(cache, "A", Date.now());
    const remove = vi.fn(async () => true);
    vi.stubGlobal("caches", { delete: remove, open: async () => cache });
    vi.stubGlobal("localStorage", { length: 0, key: () => null });
    await clearPrivateReceiptState("A");
    expect(remove).toHaveBeenCalledWith("fintrack-shared-receipts-v1");
    expect(cache.records.size).toBe(0);
  });
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
    const cache = cacheFixture(); await seed(cache, "B", Date.now());
    await purgeSharedReceipts(cache, "A");
    expect(cache.records.size).toBe(2);
  });
  it("purges orphan files without metadata", async () => {
    const cache = cacheFixture();
    await cache.put("/__shared-receipts/share/file", new Response("private image"));
    await purgeSharedReceipts(cache, "A");
    expect(cache.records.size).toBe(0);
  });
  it("rejects malformed JSON and path traversal", async () => {
    const cache = cacheFixture();
    await cache.put("/__shared-receipts/share/metadata", new Response("broken JSON"));
    expect(await claimSharedReceipt(cache, "share", "A", 2000)).toBeNull();
    expect(await claimSharedReceipt(cache, "../share", "A", 2000)).toBeNull();
    expect(cache.records.size).toBe(0);
  });
  it("quarantines valid owner-scoped monetary attempts across logout and removes orphans", () => {
    const data = new Map([
      ["fintrack:pending-save:v1:A:manual", JSON.stringify({ payload: { user_id: "A" } })],
      ["fintrack:pending-save:v1:B:manual", JSON.stringify({ payload: { user_id: "B" } })],
      ["fintrack:pending-save:v1:orphan", "{}"],
      ["fintrack:theme", "dark"],
    ]);
    const store = { get length() { return data.size; }, key: (index: number) => [...data.keys()][index] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    clearPendingFinancialDrafts(store, "A");
    expect([...data.keys()]).toEqual(["fintrack:pending-save:v1:A:manual", "fintrack:pending-save:v1:B:manual", "fintrack:theme"]);
  });
  it("preserves A's ambiguous receipt save ID and local file while B cannot adopt it", async () => {
    const payload = { user_id: "A", date: "2026-10-16", category: "Food", source: "manual", account_id: "wallet-A", type: "expense", amount: 100, merchant: "Private merchant", note: "Lunch" };
    const key = "fintrack:pending-save:v1:A:receipt:share";
    const data = new Map([[key, JSON.stringify({ id: "stable-id", payload })]]);
    const store = { get length() { return data.size; }, key: (index: number) => [...data.keys()][index] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    const cache = cacheFixture(); await seed(cache, "A", Date.now());
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("caches", { delete: async () => true, open: async () => cache });
    await clearPrivateReceiptState("A");
    expect(readTransactionAttempt(store, "B", "receipt:share")).toBeNull();
    expect(readTransactionAttempt(store, "A", "receipt:share")?.id).toBe("stable-id");
    expect(cache.records.size).toBe(2);
    expect(await claimSharedReceipt(cache, "share", "B")).toBeNull();
  });
});
