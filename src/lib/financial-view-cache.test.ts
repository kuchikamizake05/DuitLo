import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFinancialViewCache, financialViewCacheRevision, readFinancialView, writeFinancialView } from "./financial-view-cache";

describe("financial view cache", () => {
  beforeEach(() => { vi.useFakeTimers(); clearFinancialViewCache(); });
  afterEach(() => vi.useRealTimers());

  it("isolates owners and periods and expires after thirty seconds", () => {
    writeFinancialView("alice", "activity:2026-10", [42], financialViewCacheRevision());
    expect(readFinancialView("alice", "activity:2026-10")).toEqual([42]);
    expect(readFinancialView("bob", "activity:2026-10")).toBeUndefined();
    expect(readFinancialView("alice", "activity:2026-09")).toBeUndefined();
    vi.advanceTimersByTime(30_000);
    expect(readFinancialView("alice", "activity:2026-10")).toBeUndefined();
  });

  it("does not restore stale results from an in-flight request after invalidation", () => {
    const oldRevision = financialViewCacheRevision();
    writeFinancialView("alice", "dashboard", [1], oldRevision);
    clearFinancialViewCache();
    writeFinancialView("alice", "dashboard", [2], oldRevision);
    expect(readFinancialView("alice", "dashboard")).toBeUndefined();
    writeFinancialView("alice", "dashboard", [3], financialViewCacheRevision());
    expect(readFinancialView("alice", "dashboard")).toEqual([3]);
  });

  it("bounds the number of retained views", () => {
    for (let index = 0; index < 9; index++) writeFinancialView("alice", String(index), index, financialViewCacheRevision());
    expect(readFinancialView("alice", "0")).toBeUndefined();
    expect(readFinancialView("alice", "8")).toBe(8);
  });
});
