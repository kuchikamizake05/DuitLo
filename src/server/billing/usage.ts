import "server-only";
import { BillingError } from "./billing";
import { billingServiceClient, requireBillingDatabase } from "./database";

export async function reserveReceiptUsage(userId: string, operationId: string): Promise<{ reserved: boolean; replayed: boolean }> {
  if (process.env.BILLING_ENABLED !== "true") return { reserved: true, replayed: false };
  const client = billingServiceClient();
  await requireBillingDatabase(client);
  const { data, error } = await client.rpc("billing_reserve_usage", { p_user_id: userId, p_operation_id: operationId, p_metric: "receipt_scan" });
  if (error) throw new BillingError("Receipt allowance unavailable", error.code === "23514" ? 402 : 503);
  if (!data || typeof data.reserved !== "boolean" || typeof data.replayed !== "boolean") throw new BillingError("Invalid usage response");
  return data;
}

export async function finishReceiptUsage(userId: string, operationId: string, success: boolean): Promise<void> {
  if (process.env.BILLING_ENABLED !== "true") return;
  const client = billingServiceClient();
  const { error } = await client.rpc("billing_finish_usage", { p_user_id: userId, p_operation_id: operationId, p_success: success });
  if (error) throw new BillingError("Receipt usage reconciliation required");
}

export async function requireInvestmentWrite(userId: string): Promise<void> {
  if (process.env.BILLING_ENABLED !== "true") return;
  const client = billingServiceClient();
  await requireBillingDatabase(client);
  const { error } = await client.rpc("billing_assert_investment_write", { p_user_id: userId });
  if (error) throw new BillingError("Pro required for investment and trading writes", error.code === "23514" ? 403 : 503);
}
