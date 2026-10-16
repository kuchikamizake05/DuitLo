import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { completedSessionPayment, xenditProvider } from "./xendit";
import { getBillingConfig } from "./billing";
import { processPaymentWebhook } from "./webhook";

const session = { payment_session_id: "ps-test", reference_id: "fintrack-operation", session_type: "PAY", mode: "PAYMENT_LINK", status: "COMPLETED", business_id: "merchant", country: "ID", currency: "IDR", amount: 59000, payment_id: "py-paid" };
const operation = { id: "operation", user_id: "owner", invoice_id: "ps-test", external_id: "fintrack-operation", amount: 59000, currency: "IDR", term_days: 30, status: "pending", invoice_url: "https://xen.to/test" };
const config = getBillingConfig({ BILLING_ENABLED: "true", XENDIT_SECRET_KEY: "test_secret", XENDIT_CALLBACK_TOKEN: "callback", XENDIT_BUSINESS_ID: "merchant", BILLING_PRO_PRICE_IDR: "59000", BILLING_PRO_TERM_DAYS: "30", BILLING_APP_URL: "https://app.example", SUPABASE_SERVICE_ROLE_KEY: "test_role", NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co" })!;

describe("current Xendit Payment Sessions", () => {
  it("creates PAY hosted sessions with trusted price and no automatic renewal", async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...session, status: "ACTIVE", payment_link_url: "https://xen.to/test" }) });
    const result = await xenditProvider(config, transport).createInvoice({ external_id: session.reference_id, amount: 59000, currency: "IDR", description: "FinTrack Pro", success_redirect_url: "https://app.example/billing", failure_redirect_url: "https://app.example/billing" });
    expect(result.id).toBe("ps-test");
    expect(transport.mock.calls[0][0]).toBe("https://api.xendit.co/sessions");
    expect(JSON.parse(transport.mock.calls[0][1].body)).toMatchObject({ reference_id: session.reference_id, amount: 59000, country: "ID", session_type: "PAY", mode: "PAYMENT_LINK", capture_method: "AUTOMATIC", allow_save_payment_method: "DISABLED" });
  });
  it("rejects active, save, foreign, unpaid and wrong currency sessions", () => {
    expect(completedSessionPayment(session, "merchant")).not.toBeNull();
    for (const patch of [{ status: "ACTIVE" }, { session_type: "SAVE" }, { business_id: "foreign" }, { payment_id: null }, { currency: "USD" }, { country: "PH" }, { amount: NaN }, { mode: "COMPONENTS" }]) expect(completedSessionPayment({ ...session, ...patch }, "merchant")).toBeNull();
    expect(completedSessionPayment(null, "merchant")).toBeNull();
  });
  it("does not fulfill on token/amount mismatch or an unconfirmed provider state", async () => {
    const settle = vi.fn();
    const getSession = vi.fn().mockResolvedValue(session);
    const input = { token: "callback", expectedToken: "callback", businessId: "merchant", body: { event: "payment_session.completed", business_id: "merchant", data: session }, normalize: completedSessionPayment, getSession, findOperation: vi.fn().mockResolvedValue(operation), settle };
    await expect(processPaymentWebhook({ ...input, token: "forged" })).rejects.toMatchObject({ status: 401 });
    expect(getSession).not.toHaveBeenCalled();
    await expect(processPaymentWebhook({ ...input, body: { ...input.body, data: { ...session, amount: 1 } } })).rejects.toMatchObject({ status: 400 });
    getSession.mockResolvedValue({ ...session, status: "ACTIVE", payment_id: null });
    await expect(processPaymentWebhook(input)).rejects.toMatchObject({ status: 503 });
    expect(settle).not.toHaveBeenCalled();
  });
  it("confirms provider state and binds fulfillment to the stored operation", async () => {
    const settle = vi.fn();
    const getSession = vi.fn().mockResolvedValue(session);
    await expect(processPaymentWebhook({ token: "callback", expectedToken: "callback", businessId: "merchant", body: { event: "payment_session.completed", business_id: "merchant", data: session }, normalize: completedSessionPayment, getSession, findOperation: vi.fn().mockResolvedValue(operation), settle })).resolves.toEqual({ fulfilled: true });
    expect(getSession).toHaveBeenCalledWith("ps-test");
    expect(settle).toHaveBeenCalledWith(operation);
  });
  it("keeps unbound callbacks retryable and ignores expiry without downgrading Pro", async () => {
    const input = { token: "callback", expectedToken: "callback", businessId: "merchant", body: { event: "payment_session.completed", business_id: "merchant", data: session }, normalize: completedSessionPayment, getSession: vi.fn(), findOperation: vi.fn().mockResolvedValue(null), settle: vi.fn() };
    await expect(processPaymentWebhook(input)).rejects.toMatchObject({ status: 503 });
    await expect(processPaymentWebhook({ ...input, body: { ...input.body, event: "payment_session.expired" } })).resolves.toEqual({ ignored: true });
    expect(input.settle).not.toHaveBeenCalled();
  });
  it("fails closed on provider failures and prevents session ID path injection", async () => {
    const provider = xenditProvider(config, vi.fn().mockResolvedValue({ ok: false }));
    await expect(provider.getSession("ps-test")).rejects.toThrow(/unavailable/i);
    await expect(provider.getSession("../secrets")).rejects.toThrow(/Invalid/i);
  });
  it("only releases expired checkout after authoritative provider confirmation", async () => {
    const expire = vi.fn();
    const expiredSession = { ...session, status: "EXPIRED", payment_id: null };
    const input = { token: "callback", expectedToken: "callback", businessId: "merchant", body: { event: "payment_session.expired", business_id: "merchant", data: expiredSession }, normalize: completedSessionPayment, getSession: vi.fn().mockResolvedValue(expiredSession), findOperation: vi.fn().mockResolvedValue(operation), settle: vi.fn(), expire };
    await expect(processPaymentWebhook(input)).resolves.toEqual({ expired: true });
    expect(expire).toHaveBeenCalledWith(operation);
    expire.mockClear();
    input.getSession.mockResolvedValue(session);
    await expect(processPaymentWebhook(input)).resolves.toEqual({ ignored: true });
    expect(expire).not.toHaveBeenCalled();
    input.getSession.mockResolvedValue({ ...expiredSession, amount: 1 });
    await expect(processPaymentWebhook(input)).rejects.toMatchObject({ status: 503 });
    expect(expire).not.toHaveBeenCalled();
  });
});
