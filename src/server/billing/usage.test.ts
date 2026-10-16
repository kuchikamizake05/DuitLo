import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
const checkDatabase = vi.hoisted(() => vi.fn());
vi.mock("./database", () => ({ billingServiceClient: () => ({ rpc }), requireBillingDatabase: checkDatabase }));
import { reserveReceiptUsage, finishReceiptUsage, requireInvestmentWrite } from "./usage";

describe("server usage gates", () => {
  beforeEach(() => { vi.stubEnv("BILLING_ENABLED", "true"); rpc.mockReset(); checkDatabase.mockReset(); checkDatabase.mockResolvedValue(undefined); });
  afterEach(() => vi.unstubAllEnvs());
  it("reserves atomically before work and preserves replay semantics", async () => {
    rpc.mockResolvedValue({ data: { reserved: false, replayed: true }, error: null });
    await expect(reserveReceiptUsage("owner", "operation")).resolves.toEqual({ reserved: false, replayed: true });
    expect(rpc).toHaveBeenCalledWith("billing_reserve_usage", { p_user_id: "owner", p_operation_id: "operation", p_metric: "receipt_scan" });
  });
  it("fails closed on quota or unavailable database", async () => {
    rpc.mockResolvedValue({ error: { code: "23514" } });
    await expect(reserveReceiptUsage("owner", "operation")).rejects.toMatchObject({ status: 402 });
    rpc.mockResolvedValue({ error: { code: "network" } });
    await expect(reserveReceiptUsage("owner", "operation")).rejects.toMatchObject({ status: 503 });
    checkDatabase.mockRejectedValue(new Error("not configured"));
    await expect(reserveReceiptUsage("owner", "operation")).rejects.toThrow("not configured");
  });
  it("settles or refunds through a durable owner-bound operation", async () => {
    rpc.mockResolvedValue({ error: null });
    await finishReceiptUsage("owner", "operation", false);
    expect(rpc).toHaveBeenCalledWith("billing_finish_usage", { p_user_id: "owner", p_operation_id: "operation", p_success: false });
    rpc.mockResolvedValue({ error: {} });
    await expect(finishReceiptUsage("owner", "operation", true)).rejects.toMatchObject({ status: 503 });
  });
  it("denies Pro journal work but leaves disabled beta unchanged", async () => {
    rpc.mockResolvedValue({ error: { code: "23514" } });
    await expect(requireInvestmentWrite("owner")).rejects.toMatchObject({ status: 403 });
    vi.stubEnv("BILLING_ENABLED", "false");
    rpc.mockClear();
    await expect(requireInvestmentWrite("owner")).resolves.toBeUndefined();
    await expect(reserveReceiptUsage("owner", "operation")).resolves.toEqual({ reserved: true, replayed: false });
    await finishReceiptUsage("owner", "operation", false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
