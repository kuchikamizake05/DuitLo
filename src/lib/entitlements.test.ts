import { describe, expect, it } from "vitest";
import { getEntitlements } from "./entitlements";

describe("entitlements", () => {
  it("expires Pro without restricting historical reads or exports", () => {
    const limits = getEntitlements({ enabled: true, proUntil: "2026-10-01T00:00:00Z", now: new Date("2026-10-16T00:00:00Z") });
    expect(limits).toMatchObject({ plan: "free", wallets: 3, monthlyBudgets: 3, goals: 1, receiptScans: 15, investmentWrites: false, reads: true, exports: true });
  });
  it("gives active Pro150 scans and keeps beta unrestricted when billing is off", () => {
    expect(getEntitlements({ enabled: true, proUntil: "2027-01-01T00:00:00Z" }).receiptScans).toBe(150);
    expect(getEntitlements({ enabled: false }).investmentWrites).toBe(true);
  });
});
