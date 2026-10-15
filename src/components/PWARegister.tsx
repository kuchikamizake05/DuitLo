"use client";

import {DialogFrame} from "@/components/ui/DialogFrame";
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
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md flex-col gap-2 md:bottom-6" aria-live="polite" aria-atomic="true">
      {installHelp&&<DialogFrame className="pointer-events-auto" titleId="install-help-title" onClose={()=>setInstallHelp(false)}><div className="p-5 text-[var(--ink)]"><h2 id="install-help-title" className="text-lg font-semibold">{t("Pasang FinTrack")}</h2><p className="mt-3 text-sm text-[var(--ink-soft)]">{t("Buka menu browser, lalu pilih Instal aplikasi atau Tambahkan ke layar utama.")}</p><p className="mt-2 text-sm text-[var(--ink-soft)]">{t("Di iPhone atau iPad, buka menu Bagikan lalu Tambahkan ke Layar Utama.")}</p><Button className="mt-5 w-full" onClick={()=>setInstallHelp(false)}>{t("Mengerti")}</Button></div></DialogFrame>}
      {installRequested&&<StatusCard icon={Download} title={t("Permintaan instalasi diterima")} description={t("Browser sedang menyiapkan aplikasi. Periksa layar utama atau notifikasi perangkat.")} action={<Button variant="ghost" size="icon" onClick={()=>setInstallRequested(false)} aria-label={t("Tutup")}><X className="size-4"/></Button>}/>}
      {!online && (
        <StatusCard icon={WifiOff} title={t("Kamu sedang offline")} description={t("Data yang sudah terbuka tetap bisa dibaca. Perubahan baru menunggu koneksi kembali.")} />
      )}
      {updateAvailable && (
        <StatusCard icon={RefreshCw} title={t("Versi baru tersedia")} description={t("Muat ulang untuk memakai pembaruan terbaru.")} action={<Button size="compact" onClick={applyUpdate}><RefreshCw className="h-3.5 w-3.5" /> {t("Perbarui")}</Button>} />
      )}
      {showInstall && installPrompt && (
        <StatusCard
          icon={Download}
          title={t("Pasang FinTrack")}
          description={t("Buka lebih cepat dari layar utama dan nikmati tampilan penuh seperti aplikasi.")}
          action={<div className="flex gap-1"><Button variant="ghost" size="icon" className="h-9 w-9 min-h-9" onClick={dismissInstall} aria-label={t("Ingatkan nanti")}><X className="h-4 w-4" /></Button><Button size="compact" onClick={() => void installApp()}><Download className="h-3.5 w-3.5" /> {t("Pasang")}</Button></div>}
        />
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, title, description, action }: {
  icon: typeof WifiOff;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/95 p-3.5 text-slate-900 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p></div>
      {action}
    </section>
  );
}
