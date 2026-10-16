export const SHARED_RECEIPT_CACHE = "fintrack-shared-receipts-v2";
export const SHARED_RECEIPT_TTL = 24 * 60 * 60 * 1000;
type ReceiptCache = Pick<Cache, "match" | "put" | "delete" | "keys">;
export type SharedReceiptMetadata = {
  title: string; text: string; url: string;
  fileName: string | null; fileType: string | null;
  ownerId: string | null; createdAt: number; expiresAt: number;
};
const receiptPath = (id: string) => `/__shared-receipts/${id}`;
export async function removeSharedReceipt(cache: ReceiptCache, id: string) {
  await Promise.all([cache.delete(`${receiptPath(id)}/metadata`), cache.delete(`${receiptPath(id)}/file`)]);
}
function validMetadata(value: SharedReceiptMetadata, now: number) {
  return value && [value.title, value.text, value.url].every(item => typeof item === "string")
    && [value.fileName, value.fileType].every(item => item === null || typeof item === "string")
    && (value.ownerId === null || (typeof value.ownerId === "string" && Boolean(value.ownerId)))
    && Number.isFinite(value.createdAt) && Number.isFinite(value.expiresAt)
    && value.createdAt <= now && value.expiresAt > now && value.expiresAt <= value.createdAt + SHARED_RECEIPT_TTL;
}
export async function claimSharedReceipt(cache: ReceiptCache, id: string, ownerId: string | null, now = Date.now()): Promise<SharedReceiptMetadata | null> {
  if (!ownerId || !/^[a-zA-Z0-9-]+$/.test(id)) return null;
  const response = await cache.match(`${receiptPath(id)}/metadata`);
  if (!response) return null;
  const metadata = await response.json().catch(() => null) as SharedReceiptMetadata;
  if (!validMetadata(metadata, now)) { await removeSharedReceipt(cache, id); return null; }
  if (metadata.ownerId && metadata.ownerId !== ownerId) return null;
  if (!metadata.ownerId) {
    metadata.ownerId = ownerId;
    await cache.put(`${receiptPath(id)}/metadata`, new Response(JSON.stringify(metadata), { headers: { "Content-Type": "application/json" } }));
  }
  return metadata;
}
export async function withReceiptLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  // CacheStorage has no compare-and-swap; Web Locks serialize claims across tabs.
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(`fintrack:receipt:${id}`, action);
  // Refuse new claims in browsers without cross-tab locking rather than race ownership.
  throw new Error("Browser belum mendukung penyimpanan bukti yang aman.");
}
export async function purgeSharedReceipts(cache: ReceiptCache, outgoingOwner: string | null, retainedIds: ReadonlySet<string> = new Set()) {
  const visited = new Set<string>();
  for (const request of await cache.keys()) {
    const match = new URL(request.url).pathname.match(/^\/__shared-receipts\/([^/]+)\/(?:metadata|file)$/);
    if (!match || visited.has(match[1])) continue;
    visited.add(match[1]);
    const response = await cache.match(`${receiptPath(match[1])}/metadata`);
    const metadata = await response?.json().catch(() => null);
    if (metadata?.ownerId === outgoingOwner && retainedIds.has(match[1]) && validMetadata(metadata, Date.now())) continue;
    if (!metadata?.ownerId || metadata.ownerId === outgoingOwner || !validMetadata(metadata, Date.now())) await removeSharedReceipt(cache, match[1]);
  }
}
type DraftStore = Pick<Storage, "length" | "key" | "getItem" | "removeItem">;
export function clearPendingFinancialDrafts(store: DraftStore, outgoingOwner: string | null) {
  // Valid owner-scoped attempts retain their idempotency IDs even after logout.
  // Readers must request their own owner key; a different session never adopts these.
  void outgoingOwner;
  const keys = Array.from({ length: store.length }, (_, i) => store.key(i));
  for (const key of keys) {
    if (!key || !/^fintrack:pending-(save|operation):v1:/.test(key)) continue;
    let owner: unknown;
    try { const value = JSON.parse(store.getItem(key) ?? "null"); owner = value?.userId ?? value?.payload?.user_id; } catch { owner = null; }
    if (typeof owner !== "string" || !owner || !key.includes(`:v1:${owner}:`)) store.removeItem(key);
  }
}
export async function clearPrivateReceiptState(outgoingOwner: string | null) {
  const retainedIds = new Set<string>();
  if (typeof localStorage !== "undefined" && outgoingOwner) {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      const prefix = `fintrack:pending-save:v1:${outgoingOwner}:receipt:`;
      if (!key?.startsWith(prefix)) continue;
      try {
        const attempt = JSON.parse(localStorage.getItem(key) ?? "null");
        if (attempt?.payload?.user_id === outgoingOwner && typeof attempt.id === "string") retainedIds.add(key.slice(prefix.length));
      } catch { /* Corrupt attempts are removed below. */ }
    }
  }
  if (typeof caches !== "undefined") {
    await caches.delete("fintrack-shared-receipts-v1");
    const cache = await caches.open(SHARED_RECEIPT_CACHE);
    await purgeSharedReceipts(cache, outgoingOwner, retainedIds);
  }
  if (typeof localStorage !== "undefined") clearPendingFinancialDrafts(localStorage, outgoingOwner);
}
