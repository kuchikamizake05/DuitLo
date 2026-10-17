import { describe, expect, it } from "vitest";
import { activityListPage } from "./activity-list-page";

describe("progressive activity list", () => {
  it("limits rendering even when many transactions share one day, retaining full day data", () => {
    const rows = Array.from({ length: 121 }, (_, id) => ({ id, amount: 10 }));
    const grouped = new Map([["2026-10-12", rows]]);
    const first = activityListPage(grouped, 60);
    expect(first.visible).toBe(60);
    expect(first.total).toBe(121);
    expect(first.groups[0].rows.reduce((sum, row) => sum + row.amount, 0)).toBe(1210);
    expect(activityListPage(grouped, 120).visible).toBe(120);
    expect(activityListPage(grouped, 180).visible).toBe(121);
    expect(rows).toHaveLength(121);
  });

  it("preserves date order and includes empty dates without using the transaction allowance", () => {
    const result = activityListPage(new Map([
      ["2026-10-10", [1, 2]], ["2026-10-12", []], ["2026-10-11", [3]],
    ]), 1);
    expect(result.groups.map(group => group.date)).toEqual(["2026-10-12", "2026-10-11"]);
    expect(result.visible).toBe(1);
    expect(result.total).toBe(3);
  });
});
