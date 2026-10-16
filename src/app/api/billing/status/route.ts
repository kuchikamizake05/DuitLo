import { authenticateSupabaseAccessToken } from "@/infrastructure/supabase/server-client";
import { getEntitlements } from "@/lib/entitlements";
import { getBillingConfig } from "@/server/billing/billing";
import { billingServiceClient, requireBillingDatabase } from "@/server/billing/database";
import { noStoreJson as json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in to view your plan." }, 401);
  try {
    const authentication = await authenticateSupabaseAccessToken(token);
    if (!authentication.ok) return json({ error: "Sign in to view your plan." }, authentication.reason === "configuration" ? 503 : 401);
    const enabled = process.env.BILLING_ENABLED === "true";
    if (!enabled) return json({ enabled: false, checkoutAvailable: false, amount: null, termDays: null, proUntil: null, receiptScansUsed: 0, entitlements: getEntitlements({ enabled: false }) }, 200);
    const client = billingServiceClient();
    await requireBillingDatabase(client);
    const month = new Date().toISOString().slice(0, 7) + "-01";
    const [subscription, usage] = await Promise.all([
      client.from("billing_subscriptions").select("pro_until").eq("user_id", authentication.user.id).maybeSingle(),
      client.from("billing_usage_operations").select("id", { count: "exact", head: true }).eq("user_id", authentication.user.id).eq("month", month).in("status", ["reserved", "succeeded"]),
    ]);
    if (subscription.error || usage.error) return json({ error: "Plan information temporarily unavailable." }, 503);
    const config = getBillingConfig();
    const proUntil = subscription.data?.pro_until ?? null;
    return json({ enabled, checkoutAvailable: Boolean(config), amount: config?.amount ?? null, termDays: config?.termDays ?? null, proUntil, receiptScansUsed: usage.count ?? 0, entitlements: getEntitlements({ enabled, proUntil }) }, 200);
  } catch { return json({ error: "Plan information temporarily unavailable." }, 503); }
}
