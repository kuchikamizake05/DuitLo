"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import type { Entitlements } from "@/lib/entitlements";

type PlanStatus = { enabled: boolean; checkoutAvailable: boolean; amount: number | null; termDays: number | null; proUntil: string | null; receiptScansUsed: number; entitlements: Entitlements };

export default function BillingPage() {
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to view your plan.");
      const response = await fetch("/api/billing/status", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Plan information unavailable.");
      if (!controller.signal.aborted) {
        setStatus(payload);
        setError(null);
        if (payload.entitlements?.plan === "pro") {
          try { localStorage.removeItem(`fintrack:billing:${session.user.id}`); } catch { /* Payment remains protected by the server's durable operation. */ }
        }
      }
    }
    void load().catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Plan information unavailable."); });
    return () => controller.abort();
  }, [refresh]);

  async function startCheckout() {
    if (busy || !status?.checkoutAvailable) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to continue.");
      const key = `fintrack:billing:${session.user.id}`;
      let operationId: string;
      try {
        operationId = localStorage.getItem(key) ?? crypto.randomUUID();
        localStorage.setItem(key, operationId);
      } catch { throw new Error("Allow browser storage before starting a payment."); }
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ operationId }) });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 410) localStorage.removeItem(key);
        throw new Error(payload.error ?? "Payment unavailable.");
      }
      const destination = new URL(payload.invoiceUrl);
      if (destination.protocol !== "https:" || !["checkout.xendit.co", "checkout-staging.xendit.co", "xen.to", "dev.xen.to"].includes(destination.hostname)) throw new Error("Invalid payment destination.");
      window.location.assign(destination.href);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Payment unavailable."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto min-h-screen max-w-lg space-y-5 px-5 py-8">
    <Link href="/settings" className="text-sm font-semibold text-[var(--text-secondary)]">Back to settings</Link>
    <h1 className="text-2xl font-bold">Your FinTrack plan</h1>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!status && !error && <p role="status">Loading your plan…</p>}
    {status && <>
      <Surface className="space-y-3 p-5">
        <h2 className="text-xl font-bold">{status.entitlements.plan === "beta" ? "Private beta" : status.entitlements.plan === "pro" ? "FinTrack Pro" : "FinTrack Free"}</h2>
        {!status.enabled ? <p>Payments are not open yet. Your private beta access continues.</p> : <>
          <p>{status.receiptScansUsed} / {status.entitlements.receiptScans} receipt scans used this month. Resets on the first day of each month in UTC.</p>
          {status.entitlements.plan === "pro" && status.proUntil && <p>Pro access until {new Date(status.proUntil).toLocaleDateString()}.</p>}
          <p>Your existing records and exports remain available when Pro expires.</p>
        </>}
      </Surface>
      <Surface className="space-y-4 p-5">
        <h2 className="text-xl font-bold">Pro includes</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm"><li>Unlimited wallets, monthly budgets and savings goals</li><li>150 receipt scans per month</li><li>Investment and trading journal management</li></ul>
        {status.amount && status.termDays ? <p className="font-semibold">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(status.amount)} for {status.termDays} days. One payment, no automatic renewal.</p> : <p className="text-sm text-[var(--text-secondary)]">Pricing and payments will appear when checkout is available.</p>}
        <Button className="w-full" disabled={!status.checkoutAvailable} loading={busy} onClick={() => void startCheckout()}>{status.checkoutAvailable ? "Continue to secure payment" : "Payments not available yet"}</Button>
      </Surface>
    </>}
    <Button variant="secondary" onClick={() => setRefresh((value) => value + 1)}>Refresh plan</Button>
  </main>;
}
