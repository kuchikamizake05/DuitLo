import { describe, expect, it, vi } from "vitest";
import { getBillingConfig, verifyCallbackToken, validatePaidInvoice, checkout } from "./billing";

const environment = { BILLING_ENABLED: "true", XENDIT_SECRET_KEY: "xnd_test_secret", XENDIT_CALLBACK_TOKEN: "callback-secret", BILLING_PRO_PRICE_IDR: "59000", BILLING_PRO_TERM_DAYS: "30", BILLING_APP_URL: "https://fintrack.example", NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-secret" };
const expected = { id: "operation", user_id: "owner", external_id: "fintrack-operation", invoice_id: "invoice-1", amount: 59000, currency: "IDR", status: "pending", term_days: 30, invoice_url: "https://checkout.xendit.co/test" };
describe("Xendit billing security", () => {
  it("fails closed without a trusted price and defaults billing off", () => {
    expect(getBillingConfig({})).toBeNull();
    expect(getBillingConfig({ ...environment, BILLING_PRO_PRICE_IDR: "" })).toBeNull();
    expect(getBillingConfig({ ...environment, BILLING_PRO_PRICE_IDR: "NaN" })).toBeNull();
    expect(getBillingConfig(environment)?.amount).toBe(59000);
  });
  it("rejects forged, missing and differently sized callback tokens", () => {
    expect(verifyCallbackToken(null, "secret")).toBe(false);
    expect(verifyCallbackToken("wrong", "secret")).toBe(false);
    expect(verifyCallbackToken("secret", "secret")).toBe(true);
  });
  it("requires stored invoice, amount, currency and paid amount to match", () => {
    const callback = { id: "invoice-1", external_id: expected.external_id, status: "PAID", amount: 59000, paid_amount: 59000, currency: "IDR" };
    expect(validatePaidInvoice(callback, expected)).toBe(true);
    for (const patch of [{ amount: 1 }, { paid_amount: 1 }, { currency: "USD" }, { id: "other" }, { external_id: "other" }, { status: "PENDING" }]) {
      expect(validatePaidInvoice({ ...callback, ...patch }, expected)).toBe(false);
    }
  });
  it("reuses a durable operation without a second provider invoice", async () => {
    const createInvoice = vi.fn();
    const store = { claim: vi.fn().mockResolvedValue({ operation: expected, created: false }), bind: vi.fn() };
    const result = await checkout(getBillingConfig(environment)!, "owner", "11111111-1111-4111-8111-111111111111", store, { createInvoice });
    expect(result.invoiceUrl).toBe(expected.invoice_url);
    expect(createInvoice).not.toHaveBeenCalled();
  });
  it("does not retry an ambiguous provider creation and uses only server price", async () => {
    const config = getBillingConfig(environment)!;
    const store = { claim: vi.fn().mockResolvedValue({ operation: { ...expected, invoice_id: null, invoice_url: null }, created: true }), bind: vi.fn() };
    const createInvoice = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(checkout(config, "owner", "11111111-1111-4111-8111-111111111111", store, { createInvoice })).rejects.toThrow("timeout");
    expect(createInvoice).toHaveBeenCalledWith(expect.objectContaining({ amount: 59000, currency: "IDR" }));
    store.claim.mockResolvedValue({ operation: { ...expected, invoice_id: null, invoice_url: null }, created: false });
    await expect(checkout(config, "owner", "11111111-1111-4111-8111-111111111111", store, { createInvoice })).rejects.toThrow(/pending/i);
    expect(createInvoice).toHaveBeenCalledTimes(1);
  });
});
