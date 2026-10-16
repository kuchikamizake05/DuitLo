import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BillingError, type CheckoutOperation, type CheckoutStore } from "./billing";

export function billingServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new BillingError("Billing database unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function requireBillingDatabase(client: SupabaseClient) {
  const { data, error } = await client.from("billing_settings").select("enabled").eq("id", true).single();
  if (error || !data?.enabled) throw new BillingError("Billing configuration mismatch");
}

export function checkoutStore(client: SupabaseClient): CheckoutStore {
  return {
    async claim(userId, operationId, amount, termDays) {
      const { data, error } = await client.rpc("billing_claim_checkout", { p_user_id: userId, p_operation_id: operationId, p_amount: amount, p_currency: "IDR", p_term_days: termDays });
      if (error || !data?.operation) throw new BillingError("Checkout persistence unavailable");
      return data as { created: boolean; operation: CheckoutOperation };
    },
    async bind(operationId, invoiceId, invoiceUrl) {
      const { error } = await client.rpc("billing_bind_invoice", { p_operation_id: operationId, p_invoice_id: invoiceId, p_invoice_url: invoiceUrl });
      if (error) throw new BillingError("Checkout pending reconciliation", 409);
    },
  };
}
