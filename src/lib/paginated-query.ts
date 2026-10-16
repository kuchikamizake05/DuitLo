type PageResult<T> = {
  data: T[] | null;
  error: unknown;
  count?: number | null;
};

/** Fetch fresh, identically filtered queries ordered with a unique ID tie-breaker. */
export async function fetchAllRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = 1000, maxPages = 10_000 }: { pageSize?: number; maxPages?: number } = {},
): Promise<{ data: T[]; error: null }> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new Error("Pagination limits must be positive safe integers.");
  }
  const rows: T[] = [];
  const ids = new Set<string>();
  let expectedCount: number | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Incomplete pagination response: missing rows.");
    if (result.count != null) {
      if (!Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Invalid pagination count.");
      if (expectedCount !== null && expectedCount !== result.count) {
        throw new Error("Transaction collection changed while loading. Please refresh.");
      }
      expectedCount = result.count;
    }
    if (result.data.length > pageSize) throw new Error("Invalid pagination range response.");
    for (const row of result.data) {
      if (!row.id || ids.has(row.id)) throw new Error("Pagination overlap: collection changed or range was ignored.");
      ids.add(row.id);
      rows.push(row);
    }
    if (expectedCount !== null) {
      if (rows.length > expectedCount) throw new Error("Pagination count changed while loading.");
      if (rows.length === expectedCount) return { data: rows, error: null };
      if (result.data.length === 0) throw new Error("Incomplete pagination response before expected total.");
    } else if (result.data.length === 0) {
      return { data: rows, error: null };
    }
    // A server-side cap can return fewer rows than requested; only the total or an empty page ends traversal.
  }
  throw new Error("Pagination safety limit reached. Please narrow the requested period.");
}
