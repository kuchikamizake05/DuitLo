import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => vi.fn());
const claim = vi.hoisted(() => vi.fn());
const bind = vi.hoisted(() => vi.fn());
const createInvoice = vi.hoisted(() => vi.fn());
const dbReady = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/supabase/server-client", () => ({ authenticateSupabaseAccessToken: auth }));
vi.mock("@/server/http", () => ({ noStoreJson: (body: unknown, status: number) => Response.json(body, { status }) }));
vi.mock("@/server/billing/billing", async () => await import("./billing"));
vi.mock("@/server/billing/request", async () => await import("./request"));
vi.mock("@/server/billing/database", () => ({ billingServiceClient: () => ({}), checkoutStore: () => ({ claim, bind }), requireBillingDatabase: dbReady }));
vi.mock("@/server/billing/xendit", () => ({ xenditProvider: () => ({ createInvoice }) }));
import { POST } from "../../app/api/billing/checkout/route";

describe("authenticated checkout API", () => {
  beforeEach(() => {
    vi.stubEnv("BILLING_ENABLED", "true"); vi.stubEnv("BILLING_PRO_PRICE_IDR", "59000"); vi.stubEnv("BILLING_PRO_TERM_DAYS", "30"); vi.stubEnv("BILLING_APP_URL", "https://app.example");
    vi.stubEnv("XENDIT_SECRET_KEY", "test"); vi.stubEnv("XENDIT_CALLBACK_TOKEN", "token"); vi.stubEnv("XENDIT_BUSINESS_ID", "merchant"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test_role");
    auth.mockReset(); claim.mockReset(); bind.mockReset(); createInvoice.mockReset(); dbReady.mockReset();
    auth.mockResolvedValue({ ok: true, user: { id: "real-owner" } });
  });
  afterEach(() => vi.unstubAllEnvs());
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request("https://app.example/api/billing/checkout", { method: "POST", headers: { origin: "https://app.example", authorization: "Bearer signed-token", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  it("rejects missing configuration, authentication and foreign origins before provider calls", async () => {
    vi.stubEnv("BILLING_PRO_PRICE_IDR", "");
    expect((await POST(request({}))).status).toBe(503);
    vi.stubEnv("BILLING_PRO_PRICE_IDR", "59000");
    expect((await POST(request({}, { origin: "https://attacker.example" }))).status).toBe(403);
    expect((await POST(request({}, { authorization: "" }))).status).toBe(401);
    auth.mockResolvedValue({ ok: false, reason: "authentication" });
    expect((await POST(request({}))).status).toBe(401);
    expect(createInvoice).not.toHaveBeenCalled();
  });
  it("uses the authenticated owner and server price despite client tampering", async () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    claim.mockResolvedValue({ created: true, operation: { id: operationId, user_id: "real-owner", external_id: `fintrack-${operationId}`, amount: 59000, term_days: 30, status: "pending", currency: "IDR", invoice_id: null, invoice_url: null } });
    createInvoice.mockResolvedValue({ id: "ps-test", invoice_url: "https://xen.to/test" });
    expect((await POST(request({ operationId, userId: "attacker", amount: 1, termDays: 99999 }))).status).toBe(200);
    expect(claim).toHaveBeenCalledWith("real-owner", operationId, 59000, 30);
    expect(createInvoice).toHaveBeenCalledWith(expect.objectContaining({ amount: 59000 }));
  });
  it("does not create checkout when DB billing mode disagrees or operation ID is invalid", async () => {
    dbReady.mockRejectedValue(new Error("disabled"));
    expect((await POST(request({ operationId: "bad" }))).status).toBe(503);
    dbReady.mockResolvedValue(undefined);
    expect((await POST(request({ operationId: "bad" }))).status).toBe(400);
    expect(createInvoice).not.toHaveBeenCalled();
  });
});
