const entries = new Map<string, { value: unknown; expires: number }>();
let revision = 0;
const cacheKey = (owner: string, view: string) => JSON.stringify([owner, view]);

export function clearFinancialViewCache() { entries.clear(); revision += 1; }
export function financialViewCacheRevision() { return revision; }

export function readFinancialView<T>(owner: string, view: string): T | undefined {
  const key = cacheKey(owner, view);
  const entry = entries.get(key);
  if (!entry || entry.expires <= Date.now()) { entries.delete(key); return undefined; }
  return entry.value as T;
}

export function writeFinancialView<T>(owner: string, view: string, value: T, expectedRevision: number) {
  if (expectedRevision !== revision) return;
  const key = cacheKey(owner, view);
  entries.delete(key);
  if (entries.size >= 8) entries.delete(entries.keys().next().value!);
  entries.set(key, { value, expires: Date.now() + 30_000 });
}
