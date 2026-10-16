"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ReferenceRoot } from "@/components/reference/runtime";
import { useEffect, useState } from "react";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Check, ChartNoAxesCombined, ShieldCheck, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./billing.module.css";
import type { Entitlements } from "@/lib/entitlements";

type PlanStatus = { enabled: boolean; checkoutAvailable: boolean; amount: number | null; termDays: number | null; proUntil: string | null; receiptScansUsed: number; entitlements: Entitlements };

export default function BillingPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const id = language === "id";
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

  const pro = status?.entitlements.plan === "pro";
  const beta = status?.entitlements.plan === "beta";
  const price = status?.amount ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(status.amount) : null;
  const features = id ? {
    free: ["3 dompet untuk rekening, e-wallet, dan tunai", "3 anggaran bulanan", "1 target tabungan", "15 scan struk per bulan", "Catatan transaksi dan laporan", "Ekspor data keuangan"],
    pro: ["Dompet tanpa batas", "Anggaran bulanan tanpa batas", "Target tabungan tanpa batas", "150 scan struk per bulan", "Kelola investasi dan jurnal trading", "Semua fitur Free, termasuk ekspor"],
  } : {
    free: ["3 wallets for bank, e-wallet and cash", "3 monthly budgets", "1 savings goal", "15 receipt scans per month", "Transaction tracking and reports", "Financial data exports"],
    pro: ["Unlimited wallets", "Unlimited monthly budgets", "Unlimited savings goals", "150 receipt scans per month", "Investment and trading journals", "Everything in Free, including exports"],
  };

  return <ReferenceRoot page="detail" contents><Navbar onBack={() => router.push("/settings")} /><main className={styles.page}>
    <header className={styles.header}>
      <span className={styles.headerIcon}><ChartNoAxesCombined size={25} strokeWidth={1.7} aria-hidden="true" /></span>
      <div><h1>{id ? "Pilihan paket" : "Upgrade your plan"}</h1><p>{id ? "Atur hari ini. Rencanakan lebih jauh." : "Stay on top of today. Plan for what’s next."}</p></div>
    </header>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!status && !error && <p role="status" className={styles.notice}>{id ? "Memuat paketmu…" : "Loading your plan…"}</p>}
    {status && <>
      {beta && <p className={styles.notice}><Sparkles size={16} aria-hidden="true" />{id ? "Akses private beta kamu tetap aktif. Pembayaran belum dibuka." : "Your private beta access continues. Payments are not open yet."}</p>}
      <section className={styles.plans} aria-label={id ? "Perbandingan paket" : "Compare plans"}>
        <article className={styles.card}>
          <div className={styles.planHeading}><h2>Free</h2><span className={styles.planTag}>{id ? "Untuk sehari-hari" : "The everyday essentials"}</span></div>
          <p className={styles.description}>{id ? "Mulai kebiasaan keuangan yang lebih teratur, satu transaksi setiap hari." : "Build better money habits, one everyday transaction at a time."}</p>
          <div className={styles.price}><strong>Rp0</strong><span>{id ? "Gratis, seterusnya" : "Free, always"}</span></div>
          <Button variant="secondary" className={styles.planButton} disabled>{pro ? (id ? "Paket dasar" : "Base plan") : beta ? (id ? "Akses beta aktif" : "Beta access active") : (id ? "Paket saat ini" : "Current plan")}</Button>
          <ul className={styles.features}>{features.free.map(feature => <li key={feature}><Check size={15} strokeWidth={2.5} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        </article>
        <article className={`${styles.card} ${styles.proCard}`}>
          <span className={styles.recommended}><Sparkles size={13} aria-hidden="true" />{pro ? (id ? "Paketmu saat ini" : "Your current plan") : (id ? "Lebih leluasa" : "Room to grow")}</span>
          <div className={styles.planHeading}><h2>Pro</h2><span className={styles.proTag}>{id ? "Untuk rencana besarmu" : "For your bigger plans"}</span></div>
          <p className={styles.description}>{id ? "Lebih banyak ruang untuk mengelola uang, investasi, dan tujuanmu." : "More room for your money, investments and everything you’re working toward."}</p>
          <div className={styles.price}><strong className={!price ? styles.pendingPrice : undefined}>{price ?? (id ? "Segera hadir" : "Coming soon")}</strong><span>{status.termDays && price ? (id ? `untuk ${status.termDays} hari · sekali bayar` : `for ${status.termDays} days · one payment`) : (id ? "Harga tersedia saat pembayaran dibuka" : "Pricing available when payments open")}</span></div>
          <Button className={styles.planButton} disabled={!status.checkoutAvailable} loading={busy} onClick={() => void startCheckout()}><span>{!status.checkoutAvailable ? (id ? "Belum tersedia" : "Not available yet") : pro ? (id ? "Perpanjang Pro" : "Extend Pro") : (id ? "Upgrade ke Pro" : "Upgrade to Pro")}</span>{status.checkoutAvailable && <ArrowRight size={16} aria-hidden="true" />}</Button>
          <ul className={styles.features}>{features.pro.map(feature => <li key={feature}><Check size={15} strokeWidth={2.5} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        </article>
      </section>
      <div className={styles.footer}><p><ShieldCheck size={16} aria-hidden="true" />{id ? "Data dan ekspormu tetap bisa diakses saat Pro berakhir." : "Your records and exports stay accessible when Pro expires."}</p><span>{id ? "Tanpa perpanjangan otomatis." : "No automatic renewal."}</span></div>
      {status.enabled && <div className={styles.usage}><span>{id ? "Scan struk bulan ini" : "Receipt scans this month"}: <strong>{status.receiptScansUsed} / {status.entitlements.receiptScans}</strong></span>{pro && status.proUntil && <span>{id ? "Pro aktif hingga" : "Pro active until"} {new Date(status.proUntil).toLocaleDateString(id ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}<span>{id ? "Kuota direset tanggal 1 setiap bulan (UTC)." : "Scan allowance resets on the first of each month (UTC)."}</span></div>}
    </>}
    <button type="button" className={styles.refresh} onClick={() => setRefresh(value => value + 1)}>{id ? "Perbarui status paket" : "Refresh plan status"}</button>
  </main></ReferenceRoot>;
}
