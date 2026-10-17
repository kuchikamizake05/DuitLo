import { describe, expect, it } from "vitest";
import { transactionPeriod } from "./transaction-period";

describe("transaction period", () => {
  it("defaults to the current month rather than all history", () => {
    expect(transactionPeriod("", "", new Date(2026, 9, 17))).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });
  it("keeps the entire leap month available when selecting one day", () => {
    expect(transactionPeriod("2024-02-15", "2024-02-15")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
  it("loads every month touched by a custom range across years", () => {
    expect(transactionPeriod("2025-12-15", "2026-01-05")).toEqual({ start: "2025-12-01", end: "2026-01-31" });
  });
  it("supports an end date without a start date", () => {
    expect(transactionPeriod("", "2026-09-02")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });
});
