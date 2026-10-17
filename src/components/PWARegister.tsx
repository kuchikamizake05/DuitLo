"use client";

import { InstallGuide } from "@/components/InstallGuide";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/components/LanguageProvider";
import { reportHandledError } from "@/lib/errors";
import {
  getInstallPromptState,
  getNetworkSnapshot,
  getServerNetworkSnapshot,
  shouldRegisterServiceWorker,
  subscribeToNetworkStatus,
} from "@/lib/pwa";

import {watchServiceWorkerUpdates} from "@/lib/pwa-registration";

const installDismissedKey = "fintrack-install-dismissed-at";

export default function PWARegister() {
  const { t } = useLanguage();
  const online = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkSnapshot,
    getServerNetworkSnapshot,
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installHelp,setInstallHelp]=useState(false);
  const [installRequested,setInstallRequested]=useState(false);
  const installPromptRef=useRef<BeforeInstallPromptEvent|null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadOnControllerChangeRef = useRef(false);

  const installApp=useCallback(async()=>{
    const prompt=installPromptRef.current;
    if(!prompt){setInstallHelp(true);return;}
    installPromptRef.current=null;
    setInstallPrompt(null);
    setShowInstall(false);
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(choice.outcome==="accepted")setInstallRequested(true);
    }catch(error){reportHandledError("PWA installation prompt failed",error,"Permintaan instalasi belum dapat dibuka.");setInstallHelp(true);}
  },[]);

  useEffect(() => {
    let stopUpdates: (()=>void)|undefined;
    const register = () => {
      stopUpdates=watchServiceWorkerUpdates(navigator.serviceWorker,{
        onRegistration: registration=>{registrationRef.current=registration;},
        onUpdate: ()=>setUpdateAvailable(true),
        onError: error=>reportHandledError("PWA service worker registration failed",error,"Service worker belum dapat didaftarkan."),
      });
    };
    const handleInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      const standalone = window.matchMedia("(display-mode: standalone)").matches
        || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      const state = getInstallPromptState({
        standalone,
        dismissedAt: window.localStorage.getItem(installDismissedKey),
        now: Date.now(),
      });
      installPromptRef.current=promptEvent;
      setInstallPrompt(promptEvent);
      if (state === "eligible") {
        setShowInstall(true);
      }
    };
    const handleManualInstall=()=>{void installApp();};
    const handleInstallGuide=()=>setInstallHelp(true);
    const handleAppInstalled = () => {
      installPromptRef.current=null;
      setInstallRequested(false);
      setInstallPrompt(null);
      setShowInstall(false);
      window.localStorage.removeItem(installDismissedKey);
    };
    const handleControllerChange = () => {
      if (!reloadOnControllerChangeRef.current) return;
      reloadOnControllerChangeRef.current = false;
      window.location.reload();
    };

    window.addEventListener("fintrack:install-guide",handleInstallGuide);
    window.addEventListener("fintrack:request-install",handleManualInstall);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    const serviceWorkerSupported = "serviceWorker" in navigator;
    if (!shouldRegisterServiceWorker(process.env.NODE_ENV, serviceWorkerSupported)) {
      if (serviceWorkerSupported) {
        void navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      }
      if ("caches" in window) {
        void caches.keys().then((cacheNames) =>
          Promise.all(cacheNames.filter((name) => name.startsWith("fintrack-")).map((name) => caches.delete(name))),
        );
      }
    } else {
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load",register);
      stopUpdates?.();
      registrationRef.current=null;
      window.removeEventListener("fintrack:install-guide",handleInstallGuide);
      window.removeEventListener("fintrack:request-install",handleManualInstall);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [installApp]);

  function dismissInstall() {
    window.localStorage.setItem(installDismissedKey, String(Date.now()));
    setShowInstall(false);
  }

  function applyUpdate() {
    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) return;
    reloadOnControllerChangeRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <>
    {installHelp && <InstallGuide onClose={()=>setInstallHelp(false)} canInstall={Boolean(installPrompt)} onInstall={()=>void installApp()} />}
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md flex-col gap-2 md:bottom-6" aria-live="polite" aria-atomic="true">

      {installRequested&&<StatusCard icon={Download} title={t("Permintaan instalasi diterima")} description={t("Browser sedang menyiapkan aplikasi. Periksa layar utama atau notifikasi perangkat.")} action={<Button variant="ghost" size="icon" className="text-[var(--ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]" onClick={()=>setInstallRequested(false)} aria-label={t("Tutup")}><X className="size-4"/></Button>}/>}
      {!online && (
        <StatusCard icon={WifiOff} title={t("Kamu sedang offline")} description={t("Data yang sudah terbuka tetap bisa dibaca. Perubahan baru menunggu koneksi kembali.")} />
      )}
      {updateAvailable && (
        <StatusCard icon={RefreshCw} title={t("Versi baru tersedia")} description={t("Muat ulang untuk memakai pembaruan terbaru.")} action={<Button className="bg-[var(--create-bg)] text-[var(--create-fg)] shadow-[var(--shadow-control)]" size="compact" onClick={applyUpdate}><RefreshCw className="h-3.5 w-3.5" /> {t("Perbarui")}</Button>} />
      )}
      {showInstall && installPrompt && (
        <StatusCard
          icon={Download}
          title={t("Pasang DuitLo")}
          description={t("Buka lebih cepat dari layar utama dan nikmati tampilan penuh seperti aplikasi.")}
          action={<div className="flex gap-1"><Button variant="ghost" size="icon" className="h-9 w-9 min-h-9 text-[var(--ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]" onClick={dismissInstall} aria-label={t("Ingatkan nanti")}><X className="h-4 w-4" /></Button><Button className="bg-[var(--create-bg)] text-[var(--create-fg)] shadow-[var(--shadow-control)]" size="compact" onClick={() => void installApp()}><Download className="h-3.5 w-3.5" /> {t("Pasang")}</Button></div>}
        />
      )}
    </div>
    </>
  );
}

function StatusCard({ icon: Icon, title, description, action }: {
  icon: typeof WifiOff;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 text-[var(--ink)] shadow-[var(--shadow-elevated)] backdrop-blur">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-mint)] text-[var(--create-bg)]"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-xs leading-5 text-[var(--ink-soft)]">{description}</p></div>
      {action}
    </section>
  );
}
