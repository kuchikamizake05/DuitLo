import { authenticateSupabaseAccessToken } from "@/infrastructure/supabase/server-client";
import { BillingError, checkout, getBillingConfig } from "@/server/billing/billing";
import { billingServiceClient, checkoutStore, requireBillingDatabase } from "@/server/billing/database";
import { xenditProvider } from "@/server/billing/xendit";
import { readBillingJson } from "@/server/billing/request";
import { noStoreJson as json } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getBillingConfig();
  if (!config) return json({ error: "Payments are not available yet." }, 503);
  if (request.headers.get("origin") !== config.appOrigin) return json({ error: "Invalid request origin." }, 403);
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in to continue." }, 401);
  try {
    const authentication = await authenticateSupabaseAccessToken(token);
    if (!authentication.ok) return json({ error: "Sign in to continue." }, authentication.reason === "configuration" ? 503 : 401);
    const body = await readBillingJson(request, 1024);
    if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).operationId !== "string") return json({ error: "A payment operation ID is required." }, 400);
    const client = billingServiceClient();
    await requireBillingDatabase(client);
    const result = await checkout(config, authentication.user.id, (body as { operationId: string }).operationId, checkoutStore(client), xenditProvider(config));
    return json(result, 200);
  } catch (error) {
    const status = error instanceof BillingError ? error.status : 503;
    return json({ error: status === 410 ? "Your payment session expired. Try again to start a new checkout." : status === 409 ? "Your payment is already being processed. Refresh your plan or contact support before starting another payment." : status === 400 ? "Invalid checkout request." : "Payments are temporarily unavailable." }, status);
  }
}
