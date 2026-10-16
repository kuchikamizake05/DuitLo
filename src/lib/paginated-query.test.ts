import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "./paginated-query";

describe("fetchAllRows", () => {
  it("advances by actual rows under a smaller server cap and preserves order", async () => {
    const rows = Array.from({ length: 11 }, (_, id) => ({ id: String(id), date: "2026-10-16" }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + 3)), error: null, count: rows.length }));
    const result = await fetchAllRows(fetchPage, { pageSize: 1000 });
    expect(result.data).toEqual(rows);
    expect(fetchPage.mock.calls.map(([from]) => from)).toEqual([0, 3, 6, 9]);
  });

  it("propagates later-page failure instead of returning incomplete totals", async () => {
    const failure = new Error("backend unavailable");
    await expect(fetchAllRows(async (from) => from === 0
      ? { data: [{ id: "a" }], error: null, count: 2 }
      : { data: null, error: failure, count: null })).rejects.toBe(failure);
  });

  it("rejects overlapping or ignored ranges instead of duplicating rows or looping", async () => {
    const page = vi.fn(async () => ({ data: [{ id: "a" }], error: null, count: 3 }));
    await expect(fetchAllRows(page)).rejects.toThrow(/overlap/i);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it("rejects a prematurely empty page and changing totals", async () => {
    await expect(fetchAllRows(async () => ({ data: [], error: null, count: 2 }))).rejects.toThrow(/incomplete/i);
    await expect(fetchAllRows(async (from) => ({ data: [{ id: String(from) }], error: null, count: from === 0 ? 3 : 4 }))).rejects.toThrow(/changed/i);
  });

  it("handles an empty owner/month scope", async () => {
    expect((await fetchAllRows(async () => ({ data: [], error: null, count: 0 }))).data).toEqual([]);
  });

  it("rejects unbounded or invalid pagination options", async () => {
    const page = vi.fn(async (from: number) => ({ data: [{ id: String(from) }], error: null, count: null }));
    await expect(fetchAllRows(page, { maxPages: 2 })).rejects.toThrow(/limit/i);
    await expect(fetchAllRows(page, { pageSize: 0 })).rejects.toThrow(/positive/i);
  });
});
