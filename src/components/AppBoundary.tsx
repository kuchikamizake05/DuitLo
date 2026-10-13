"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CloudOff, Database, RefreshCw } from "lucide-react";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/Button";
import { getAuthGateState, sanitizeNextPath } from "@/lib/auth";
import { getNetworkSnapshot, getServerNetworkSnapshot, subscribeToNetworkStatus } from "@/lib/pwa";
import { isSupabaseConfigured, supabase } from "@/infrastructure/supabase/browser-client";
import PasskeyUnlockScreen from "@/components/PasskeyUnlockScreen";
import { useLanguage } from "@/components/LanguageProvider";
import { PASSKEY_STATE_CHANGE_EVENT, clearPasskeyDeviceState, readPasskeyDeviceState, writePasskeyDeviceState } from "@/lib/passkeys";

export default function AppBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);
  const [resolved, setResolved] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [passkeyLocked, setPasskeyLocked] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const updatePasskeyLock = useCallback((nextSession: Session | null) => {
    sessionRef.current = nextSession;
    const deviceState = nextSession ? readPasskeyDeviceState(nextSession.user.id) : null;
    setPasskeyLocked(Boolean(deviceState?.enabled && deviceState.locked));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      sessionRef.current=data.session;
      setSession(data.session);
      setHasSession(Boolean(data.session));
      const deviceState = data.session ? readPasskeyDeviceState(data.session.user.id) : null;
      if (data.session && deviceState?.enabled) {
        writePasskeyDeviceState({ ...deviceState, locked: true });
        setPasskeyLocked(true);
      } else {
        updatePasskeyLock(data.session);
      }
      setResolved(true);
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setHasSession(false);
      setPasskeyLocked(false);
      setResolved(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setHasSession(Boolean(nextSession));
      updatePasskeyLock(nextSession);
      setResolved(true);
    });

    const updateFromStorage = () => updatePasskeyLock(sessionRef.current);
    window.addEventListener("storage", updateFromStorage);
    window.addEventListener(PASSKEY_STATE_CHANGE_EVENT, updateFromStorage);

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener("storage", updateFromStorage);
      window.removeEventListener(PASSKEY_STATE_CHANGE_EVENT, updateFromStorage);
    };
  }, [updatePasskeyLock]);

  const gate = getAuthGateState({
    pathname,
    configured: isSupabaseConfigured,
    resolved,
    hasSession,
    online,
  });

  useEffect(() => {
    if (gate !== "redirect-login") return;
    const destination = sanitizeNextPath(`${pathname}${window.location.search}`);
    router.replace(`/login?next=${encodeURIComponent(destination)}`);
  }, [gate, pathname, router]);

  if (gate === "public") return children;
  if (gate === "authenticated" && passkeyLocked && session) {
    const deviceState = readPasskeyDeviceState(session.user.id);
    return (
      <PasskeyUnlockScreen
        emailHint={deviceState?.emailHint ?? "Akun FinTrack"}
        userId={session.user.id}
        onUnlock={() => writePasskeyDeviceState({
          userId: session.user.id,
          emailHint: deviceState?.emailHint ?? "Akun FinTrack",
          enabled: true,
          locked: false,
        })}
        onUseNormalLogin={async () => {
          const {error}=await supabase.auth.signOut({scope:"local"});
          if(error)throw error;
          clearPasskeyDeviceState(session.user.id);
          router.replace("/login");
        }}
      />
    );
  }
  if (gate === "authenticated") return children;
  if (gate === "configuration-error") return <ConfigurationRequired />;
  if (gate === "offline") return <OfflineRecovery />;
  return <ApplicationLoading />;
}

export function ApplicationLoading() {
 const pathname=usePathname();
 const variants={"/dashboard":"dashboard","/accounts":"wallet","/transactions":"activity","/insights":"insights","/investments":"portfolio","/settings":"settings","/planning":"budget","/goals":"goals","/trading":"trading","/reports":"archive","/journey":"journey","/onboarding":"onboarding","/shared-receipt":"receipt"} as const;
 const variant=variants[pathname as keyof typeof variants]??"dashboard";
 return <div className="ft-application-loading"><main id="main-content" tabIndex={-1} className="px-margin pt-5"><PageSkeleton variant={variant}/></main></div>;
}

export function ConfigurationRequired() {
  const { t } = useLanguage();
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10 outline-none">
      <section className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Database className="h-6 w-6" /></span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{t("Penyiapan lingkungan")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{t("Supabase belum dikonfigurasi")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t("Tambahkan URL proyek dan anon key browser-safe ke .env.local. FinTrack menghentikan akses data sampai konfigurasi valid.")}</p>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700">
          <p>NEXT_PUBLIC_SUPABASE_URL=https://…</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=…</p>
        </div>
        <Button className="mt-5 w-full" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> {t("Muat ulang konfigurasi")}</Button>
      </section>
    </main>
  );
}

function OfflineRecovery() {
  const { t } = useLanguage();
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#e9f8ee_0%,#f7faf7_55%,#f8faf9_100%)] px-4 py-10 outline-none">
      <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><CloudOff className="h-6 w-6" /></span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">{t("Sesi belum tersedia offline")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t("Sambungkan internet untuk memverifikasi sesi. Data privat tidak dibuka tanpa sesi lokal yang valid.")}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> {t("Coba lagi")}</Button>
          <Link href="/offline" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"><AlertTriangle className="h-4 w-4" /> {t("Bantuan offline")}</Link>
        </div>
      </section>
    </main>
  );
}
