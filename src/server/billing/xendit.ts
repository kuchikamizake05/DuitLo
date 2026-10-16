import "server-only";
import { BillingError, type BillingConfig, type CheckoutProvider } from "./billing";

type Session = Record<string, unknown>;

export function completedSessionPayment(value: unknown, businessId: string) {
  if (!value || typeof value !== "object") return null;
  const session = value as Session;
  if (session.status !== "COMPLETED" || session.session_type !== "PAY" || session.mode !== "PAYMENT_LINK" || session.business_id !== businessId || session.country !== "ID" || session.currency !== "IDR" || typeof session.payment_id !== "string" || !session.payment_id.startsWith("py-") || typeof session.payment_session_id !== "string" || !session.payment_session_id.startsWith("ps-") || !Number.isSafeInteger(session.amount) || (session.amount as number) <= 0) return null;
  return { id: session.payment_session_id, external_id: session.reference_id, currency: session.currency, amount: session.amount, paid_amount: session.amount, status: "PAID" };
}

export function xenditProvider(config: BillingConfig, fetchImpl: typeof fetch = fetch): CheckoutProvider & { getSession: (id: string) => Promise<Session> } {
  async function request(path: string, method: "GET" | "POST", body?: unknown) {
    const response = await fetchImpl(`https://api.xendit.co${path}`, { method, headers: { Authorization: `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new BillingError("Payment provider temporarily unavailable");
    return await response.json() as Session;
  }
  return {
    async createInvoice(input) {
      const session = await request("/sessions", "POST", { reference_id: input.external_id, session_type: "PAY", mode: "PAYMENT_LINK", amount: input.amount, currency: "IDR", country: "ID", capture_method: "AUTOMATIC", allow_save_payment_method: "DISABLED", description: input.description, success_return_url: input.success_redirect_url, cancel_return_url: input.failure_redirect_url });
      if (typeof session.payment_session_id !== "string" || !session.payment_session_id.startsWith("ps-") || typeof session.payment_link_url !== "string" || session.reference_id !== input.external_id || session.amount !== input.amount || session.currency !== "IDR" || session.business_id !== config.businessId || session.status !== "ACTIVE") throw new BillingError("Unexpected payment provider response");
      return { id: session.payment_session_id, invoice_url: session.payment_link_url };
    },
    async getSession(id) {
      if (!/^ps-[a-zA-Z0-9-]{1,100}$/.test(id)) throw new BillingError("Invalid payment session", 400);
      return request(`/sessions/${encodeURIComponent(id)}`, "GET");
    },
  };
}
