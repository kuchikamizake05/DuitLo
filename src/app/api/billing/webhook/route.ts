import { BillingError, getBillingConfig, verifyCallbackToken } from "@/server/billing/billing";
import { billingServiceClient } from "@/server/billing/database";
import { processPaymentWebhook } from "@/server/billing/webhook";
import { completedSessionPayment, xenditProvider } from "@/server/billing/xendit";
import { readBillingJson } from "@/server/billing/request";
import { noStoreJson as json } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getBillingConfig();
  if (!config) return json({ error: "Payments unavailable." }, 503);
  const token = request.headers.get("x-callback-token");
  if (!verifyCallbackToken(token, config.callbackToken)) return json({ error: "Invalid callback." }, 401);
  try {
    const body = await readBillingJson(request, 65536);
    const client = billingServiceClient();
    const result = await processPaymentWebhook({ token, expectedToken: config.callbackToken, body, businessId: config.businessId,
      getSession: xenditProvider(config).getSession, normalize: completedSessionPayment,
      async findOperation(id) {
        const { data, error } = await client.from("billing_checkout_operations").select("*").eq("invoice_id", id).maybeSingle();
        if (error) throw new BillingError("Payment persistence unavailable");
        return data;
      },
      async settle(operation) {
        const { error } = await client.rpc("billing_settle_invoice", { p_invoice_id: operation.invoice_id, p_external_id: operation.external_id, p_amount: operation.amount, p_currency: operation.currency });
        if (error) throw new BillingError("Payment reconciliation required");
      },
      async expire(operation) {
        const { error } = await client.rpc("billing_expire_checkout", { p_operation_id: operation.id, p_invoice_id: operation.invoice_id });
        if (error) throw new BillingError("Payment expiry reconciliation required");
      },
    });
    return json(result, 200);
  } catch (error) {
    return json({ error: "Callback could not be fulfilled." }, error instanceof BillingError ? error.status : 503);
  }
}
