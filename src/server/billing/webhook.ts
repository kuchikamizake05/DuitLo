import { BillingError, verifyCallbackToken, validatePaidInvoice, type CheckoutOperation } from "./billing";

export async function processPaymentWebhook({ token, expectedToken, body, businessId, getSession, normalize, findOperation, settle, expire }: {
  token: string | null; expectedToken: string; body: unknown; businessId: string;
  getSession: (id: string) => Promise<Record<string, unknown>>;
  normalize: (session: unknown, businessId: string) => { id: string; external_id: unknown; amount: unknown; currency: unknown; paid_amount: unknown; status: string } | null;
  findOperation: (sessionId: string) => Promise<CheckoutOperation | null>;
  settle: (operation: CheckoutOperation) => Promise<void>;
  expire?: (operation: CheckoutOperation) => Promise<void>;
}) {
  if (!verifyCallbackToken(token, expectedToken)) throw new BillingError("Invalid callback", 401);
  if (!body || typeof body !== "object") throw new BillingError("Invalid callback", 400);
  const envelope = body as Record<string, unknown>;
  if (envelope.business_id !== businessId) throw new BillingError("Merchant mismatch", 400);
  const expiration = envelope.event === "payment_session.expired" && Boolean(expire);
  if (envelope.event !== "payment_session.completed" && !expiration) return { ignored: true };
  if (!envelope.data || typeof envelope.data !== "object") throw new BillingError("Invalid callback", 400);
  const data = envelope.data as Record<string, unknown>;
  if (typeof data.payment_session_id !== "string" || !/^ps-[a-zA-Z0-9-]{1,100}$/.test(data.payment_session_id)) throw new BillingError("Invalid session", 400);
  const operation = await findOperation(data.payment_session_id);
  if (!operation) throw new BillingError("Payment awaiting checkout binding");
  if (expiration) {
    const confirmed = await getSession(data.payment_session_id);
    if (confirmed.status === "COMPLETED") return { ignored: true };
    if (confirmed.status !== "EXPIRED" || confirmed.business_id !== businessId || confirmed.session_type !== "PAY" || confirmed.payment_session_id !== operation.invoice_id || confirmed.reference_id !== operation.external_id || confirmed.amount !== operation.amount || confirmed.currency !== operation.currency) throw new BillingError("Expiry not confirmed");
    await expire!(operation);
    return { expired: true };
  }
  const notifiedPayment = normalize(data, businessId);
  if (!notifiedPayment || !validatePaidInvoice(notifiedPayment, operation)) throw new BillingError("Payment mismatch", 400);
  const confirmedPayment = normalize(await getSession(data.payment_session_id), businessId);
  if (!confirmedPayment || !validatePaidInvoice(confirmedPayment, operation)) throw new BillingError("Payment not confirmed");
  await settle(operation);
  return { fulfilled: true };
}
