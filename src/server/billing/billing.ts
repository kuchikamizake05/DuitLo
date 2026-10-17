import { createHash, timingSafeEqual } from "node:crypto";

export type BillingConfig = { amount: number; termDays: number; appOrigin: string; secretKey: string; callbackToken: string; businessId: string };
export type CheckoutOperation = {
  id: string; user_id: string; external_id: string; invoice_id: string | null;
  amount: number; currency: string; term_days: number; status: string; invoice_url: string | null;
};
export type CheckoutStore = {
  claim: (userId: string, operationId: string, amount: number, termDays: number) => Promise<{ created: boolean; operation: CheckoutOperation }>;
  bind: (operationId: string, invoiceId: string, invoiceUrl: string) => Promise<void>;
};
export type CheckoutProvider = {
  createInvoice: (input: { external_id: string; amount: number; currency: "IDR"; description: string; success_redirect_url: string; failure_redirect_url: string }) => Promise<{ id: string; invoice_url: string }>;
};
export class BillingError extends Error {
  constructor(message: string, public readonly status = 503) { super(message); }
}

export function getBillingConfig(environment: Record<string, string | undefined> = process.env): BillingConfig | null {
  if (environment.BILLING_ENABLED !== "true") return null;
  const amount = Number(environment.BILLING_PRO_PRICE_IDR);
  const termDays = Number(environment.BILLING_PRO_TERM_DAYS);
  const secretKey = environment.XENDIT_SECRET_KEY?.trim();
  const callbackToken = environment.XENDIT_CALLBACK_TOKEN?.trim();
  const businessId = environment.XENDIT_BUSINESS_ID?.trim();
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(termDays) || termDays < 1 || termDays > 366 || !secretKey || !callbackToken || !businessId || !environment.SUPABASE_SERVICE_ROLE_KEY?.trim() || !environment.NEXT_PUBLIC_SUPABASE_URL?.trim()) return null;
  try {
    const url = new URL(environment.BILLING_APP_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return { amount, termDays, appOrigin: url.origin, secretKey, callbackToken, businessId };
  } catch { return null; }
}

export function verifyCallbackToken(received: string | null, expected: string): boolean {
  if (!received || !expected || received.length > 4096) return false;
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

export function validatePaidInvoice(value: unknown, expected: CheckoutOperation): boolean {
  if (!value || typeof value !== "object") return false;
  const payment = value as Record<string, unknown>;
  return payment.status === "PAID" && payment.id === expected.invoice_id && payment.external_id === expected.external_id && payment.currency === expected.currency && payment.amount === expected.amount && payment.paid_amount === expected.amount;
}

export function isTrustedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && ["checkout.xendit.co", "checkout-staging.xendit.co", "xen.to", "dev.xen.to"].includes(url.hostname);
  } catch { return false; }
}

export async function checkout(config: BillingConfig, userId: string, operationId: string, store: CheckoutStore, provider: CheckoutProvider) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) throw new BillingError("Invalid operation ID", 400);
  const { operation, created } = await store.claim(userId, operationId, config.amount, config.termDays);
  if (operation.user_id !== userId) throw new BillingError("Checkout owner mismatch", 403);
  if (operation.status === "paid") throw new BillingError("Payment already completed; refresh your plan.", 409);
  if (operation.status === "expired") throw new BillingError("Payment session expired. Start a new checkout.", 410);
  if (operation.invoice_url && operation.invoice_id) {
    if (!isTrustedCheckoutUrl(operation.invoice_url)) throw new BillingError("Invalid checkout destination");
    return { invoiceUrl: operation.invoice_url, operationId: operation.id };
  }
  if (!created) throw new BillingError("Checkout pending reconciliation. Please contact support before starting another payment.", 409);
  const invoice = await provider.createInvoice({ external_id: operation.external_id, amount: operation.amount, currency: "IDR", description: `DuitLo Pro · ${operation.term_days} days`, success_redirect_url: `${config.appOrigin}/billing?payment=returned`, failure_redirect_url: `${config.appOrigin}/billing?payment=cancelled` });
  if (!invoice.id || !isTrustedCheckoutUrl(invoice.invoice_url)) throw new BillingError("Invalid provider checkout response");
  await store.bind(operation.id, invoice.id, invoice.invoice_url);
  return { invoiceUrl: invoice.invoice_url, operationId: operation.id };
}
