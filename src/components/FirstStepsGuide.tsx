"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {BookOpen,ChevronRight} from "lucide-react";
import { useOnboarding } from "./OnboardingBoundary";
import { useLanguage } from "./LanguageProvider";

const guideFigures = ["home", "wallet", "record", "activity", "reports", "budget", "goals"] as const;
const changeEvent = "fintrack:guide-change";
const menuSteps = [
  { title:"Beranda", description:"Lihat saldo dan ringkasan keuanganmu. Dari sini kamu juga bisa membuka anggaran dan target tabungan.", href:"/dashboard", pose:"wallet" },
  { title:"Dompet", description:"Kelola rekening, e-wallet, dan uang tunai. Tambahkan akun atau periksa saldo dari menu ini.", href:"/accounts", pose:"wallet" },
  { title:"Catat", description:"Ketuk tombol plus untuk mencatat manual atau membaca struk. Periksa detail transaksi sebelum menyimpannya.", href:"/transactions?new=1", pose:"transaction" },
  { title:"Aktivitas", description:"Lihat riwayat transaksi, cari catatan, dan gunakan filter untuk menemukan transaksi tertentu.", href:"/transactions", pose:"transaction" },
  { title:"Laporan", description:"Lihat pola pemasukan dan pengeluaran. Pilih periode untuk membandingkan ringkasan keuanganmu.", href:"/insights", pose:"transaction" },
  { title:"Anggaran", description:"Buka anggaran untuk menentukan batas pengeluaran bulanan. Pilih kategori dan nominal yang sesuai kebutuhanmu.", href:"/planning", pose:"wallet" },
  { title:"Target Tabungan", description:"Buka target tabungan untuk merencanakan tujuanmu. Tentukan nominal tujuan, setoran awal, dan tenggat waktunya.", href:"/goals", pose:"wallet" },
] as const;
const subscribe = (callback: () => void) => {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changeEvent, callback);
    window.removeEventListener("storage", callback);
  };
};

export function FirstStepsGuide() {
  const onboarding = useOnboarding(false);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const key = onboarding ? `fintrack:click-guide:${onboarding.userId}` : "";
  const menuKey = onboarding ? `fintrack:menu-guide:${onboarding.userId}` : "";
  useEffect(() => {
    if (!onboarding || new URLSearchParams(window.location.search).get("tutorial")!=="start") return;
    localStorage.setItem(menuKey,"0");
    localStorage.setItem(`${menuKey}:mode`,"active");
    window.dispatchEvent(new Event(changeEvent));
    router.replace("/dashboard");
  }, [onboarding,pathname,menuKey,router]);
  const menuMode = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(`${menuKey}:mode`) === "active"; } catch { return false; }
  }, () => false);
  const menuStep = useSyncExternalStore(subscribe, () => {
    try {
      const saved = Number(localStorage.getItem(menuKey) ?? menuSteps.length);
      return Number.isInteger(saved) && saved >= 0 && saved <= menuSteps.length ? saved : menuSteps.length;
    } catch { return menuSteps.length; }
  }, () => menuSteps.length);
  const dismissed = useSyncExternalStore(subscribe, () => {
    try { return Boolean(key && localStorage.getItem(key) === "dismissed"); } catch { return false; }
  }, () => true);
  const [target, setTarget] = useState<{left:number;top:number;width:number;height:number;viewportWidth:number;viewportHeight:number;manual:boolean;radius:number} | null>(null);
  const hasAccount = onboarding?.hasAccount ?? false;
  const hasTransaction = onboarding?.hasTransaction ?? false;
  useEffect(() => {
    if (!onboarding || hasTransaction || dismissed) return;
    try {
      if (localStorage.getItem(menuKey) === null && localStorage.getItem(`${menuKey}:mode`)!=="paused") {
        localStorage.setItem(menuKey,"0");
        localStorage.setItem(`${menuKey}:mode`,"active");
        window.dispatchEvent(new Event(changeEvent));
      }
    } catch {}
  }, [onboarding, hasTransaction, dismissed, menuKey]);
  const paused = useSyncExternalStore(subscribe, () => localStorage.getItem(`${menuKey}:mode`)==="paused", () => false);
  const touringMenus = hasTransaction || menuMode || !dismissed;
  const practice = touringMenus && (menuStep===1 && !hasAccount || menuStep===2 && !hasTransaction);
  useEffect(() => {
    if (!onboarding || paused || !touringMenus) return;
    const practiceKey = `${menuKey}:practice`;
    if (menuStep===1 && !hasAccount) localStorage.setItem(practiceKey,"wallet");
    if (menuStep===2 && !hasTransaction) localStorage.setItem(practiceKey,"transaction");
    const expected = localStorage.getItem(practiceKey);
    if (menuStep===1 && hasAccount && expected==="wallet" || menuStep===2 && hasTransaction && expected==="transaction") {
      localStorage.removeItem(practiceKey);
      localStorage.setItem(menuKey,String(menuStep+1));
      window.dispatchEvent(new Event(changeEvent));
    }
  }, [onboarding,paused,touringMenus,menuStep,hasAccount,hasTransaction,menuKey]);
  const currentMenu = menuSteps[Math.min(menuStep,menuSteps.length-1)];
  const enabled = Boolean(onboarding && !paused && (touringMenus ? menuStep < menuSteps.length : !dismissed));
  const navigationSelector = `nav[aria-label="${t("Navigasi utama")}"]`;
  const selector = touringMenus
    ? practice && menuStep===1 && pathname==="/accounts" ? '[data-guide="add-wallet"]' : menuStep>=5 ? `[data-guide="${menuStep===5?"budget":"goal"}"]` : `${navigationSelector} a[href="${currentMenu.href}"]`
    : hasAccount
    ? `${navigationSelector} a[href="/transactions?new=1"]`
    : pathname === "/accounts"
      ? '[data-guide="add-wallet"]'
      : `${navigationSelector} a[href="/accounts"]`;

  useEffect(() => {
    if (!enabled) return;
    let highlighted: HTMLElement | null = null;
    function update() {
      const manual = hasAccount && (!touringMenus || menuStep === 2) ? document.querySelector<HTMLElement>('button[aria-label="' + t("Catat manual") + '"]') : null;
      const next = document.querySelector('[aria-modal="true"]') ? null : manual ?? document.querySelector<HTMLElement>(selector);
      if (highlighted !== next) {
        highlighted?.classList.remove("ft-guide-target");
        next?.classList.add("ft-guide-target");
        highlighted = next;
        if (next && touringMenus && menuStep>=5) next.scrollIntoView({block:"center",behavior:"instant"});
      }
      const rect = next?.getBoundingClientRect();
      const value = rect && rect.width && rect.height ? {left:rect.left,top:rect.top,width:rect.width,height:rect.height,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,manual:Boolean(manual),radius:Math.max(parseFloat(getComputedStyle(next!).borderTopLeftRadius)||0,...Array.from(next!.children).map(child=>parseFloat(getComputedStyle(child).borderTopLeftRadius)||0))} : null;
      setTarget(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
    }
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize",update);
    window.addEventListener("scroll",update,true);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(document.body);
    return () => { observer.disconnect(); resizeObserver.disconnect(); window.removeEventListener("resize",update); window.removeEventListener("scroll",update,true); highlighted?.classList.remove("ft-guide-target"); };
  }, [enabled, selector, hasAccount, touringMenus, menuStep, t]);

  useEffect(() => {
    if (!onboarding) return;
    const refresh = () => { void onboarding.refresh(); };
    window.addEventListener("fintrack:setup-data-saved", refresh);
    return () => window.removeEventListener("fintrack:setup-data-saved", refresh);
  }, [onboarding]);

  if (!enabled || !target) return null;
  const walletAction = pathname==="/accounts" && (practice && menuStep===1 || !touringMenus && !hasAccount);
  const spotlightWidth = Math.min(target.width + 24, 88);
  const spotlightLeft = target.left + (target.width-spotlightWidth)/2;
  const bubbleWidth = Math.min(380,target.viewportWidth-24);
  const left = Math.max(12,Math.min(target.left+target.width/2-bubbleWidth/2,target.viewportWidth-bubbleWidth-12));
  const above = target.top > target.viewportHeight/2;
  const arrowLeft = Math.max(24,Math.min(target.left+target.width/2-left,bubbleWidth-24));
  function moveMenu(step: number) {
    try { localStorage.setItem(menuKey,String(step)); if(step===menuSteps.length){localStorage.setItem(`${menuKey}:status`,"completed");localStorage.setItem(`${menuKey}:mode`,"completed");} } catch {}
    window.dispatchEvent(new Event(changeEvent));
    window.dispatchEvent(new Event("fintrack:guide-close-menu"));
    if(step < menuSteps.length) router.push(step>=5 ? "/dashboard" : step === 2 ? "/accounts" : menuSteps[step].href);
  }
  const hitLeft = Math.max(0,target.left-4);
  const hitTop = Math.max(0,target.top-4);
  const hitRight = Math.min(target.viewportWidth,target.left+target.width+4);
  const hitBottom = Math.min(target.viewportHeight,target.top+target.height+4);
  return createPortal(<>
  <div aria-hidden="true" className="fixed inset-0 z-[60] pointer-events-none">
    <div className="absolute pointer-events-auto" style={{top:0,left:0,right:0,height:hitTop}}/>
    <div className="absolute pointer-events-auto" style={{top:hitBottom,left:0,right:0,bottom:0}}/>
    <div className="absolute pointer-events-auto" style={{top:hitTop,left:0,width:hitLeft,height:hitBottom-hitTop}}/>
    <div className="absolute pointer-events-auto" style={{top:hitTop,left:hitRight,right:0,height:hitBottom-hitTop}}/>
  </div>
  <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] h-full w-full">
    <defs><mask id="first-steps-spotlight"><rect width="100%" height="100%" fill="white"/><rect x={target.manual || touringMenus && menuStep>=5 || walletAction ? target.left-10 : spotlightLeft} y={target.top-10} width={target.manual || touringMenus && menuStep>=5 || walletAction ? target.width+20 : spotlightWidth} height={target.height+20} rx={Math.min((target.height+20)/2,Math.max(24,target.radius+10))} fill="black"/></mask></defs>
    <rect width="100%" height="100%" className="ft-guide-dimmer" fill="#07140e" fillOpacity=".56" mask="url(#first-steps-spotlight)"/>
  </svg>
  <aside aria-live="polite" aria-label={t("Panduan langkah pertama")} className="ft-guide-card fixed z-[61] rounded-[20px] bg-white px-4 pb-4 pt-1 text-[#161d1a] shadow-xl" style={{left,width:bubbleWidth,...(above?{bottom:target.viewportHeight-target.top+22}:{top:target.top+target.height+22})}}>
    <span aria-hidden="true" className="ft-guide-arrow absolute size-4 rotate-45 bg-white" style={{left:arrowLeft-8,...(above?{bottom:-7}:{top:-7})}}/>
    <div className="flex items-center justify-between gap-3">
      <div role="progressbar" aria-label={t("Panduan langkah pertama")} aria-valuemin={0} aria-valuemax={touringMenus?menuSteps.length:2} aria-valuenow={touringMenus?menuStep+1:hasAccount?2:1} className="flex h-6 items-center gap-1.5">
        {Array.from({length:touringMenus?menuSteps.length:2},(_,position)=>{
          const active=position===(touringMenus?menuStep:hasAccount?1:0);
          return <span key={position} aria-hidden="true" className={`h-1.5 shrink-0 rounded-full ${active?"ft-guide-progress-active w-5 bg-[#00652c]":"ft-guide-progress-idle w-1.5 bg-[#d5dfd8]"}`}/>;
        })}
      </div>

      <button type="button" className="ft-guide-skip min-h-11 px-2 py-2 text-[14px] leading-5 font-bold text-[#253e32]" onClick={() => {
        try { localStorage.setItem(`${menuKey}:mode`,"paused"); localStorage.setItem(`${menuKey}:status`,"deferred"); } catch {}
        window.dispatchEvent(new Event(changeEvent));
      }}>{t("Lewati")}</button>
    </div>
    <div className="flex items-center gap-10">
    <span aria-hidden="true" className="relative -ml-2 min-h-32 w-24 shrink-0">
      <Image src={touringMenus ? `/onboarding/guide-${guideFigures[Math.min(menuStep,guideFigures.length-1)]}.png` : `/onboarding/guide-${hasAccount ? "record" : "wallet"}.png`} alt="" width={176} height={176} className="pointer-events-none absolute -left-3 -top-5 h-44 w-36 max-w-none object-contain" />
    </span>
    <div className="min-w-0 flex-1 py-2"><h2 className="text-[16px] leading-[23px] font-bold text-[#161d1a]">{t(touringMenus?currentMenu.title:hasAccount ? "Sekarang catat transaksi" : "Tambahkan dompet pertamamu")}</h2>
    <p className="mt-1.5 text-[14px] leading-[21px] text-[#3f493f]">{t(practice ? menuStep===1 ? "Ketuk Tambah Dompet, lalu isi akun dan saldo awalmu." : target.manual ? "Pilih Catat manual untuk mengisi transaksi pertamamu." : "Ketuk Catat, lalu pilih Catat manual untuk mencatat transaksi pertamamu." : touringMenus?currentMenu.description:hasAccount
      ? target.manual ? "Pilih Catat manual untuk mengisi transaksi pertamamu." : "Ketuk Catat, lalu pilih Catat manual untuk mencatat transaksi pertamamu."
      : pathname === "/accounts"
        ? "Ketuk Tambah Dompet, lalu isi akun dan saldo awalmu."
        : "Ketuk Dompet di bawah untuk menambahkan rekening, e-wallet, atau uang tunai.")}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-end gap-3">

      {touringMenus&&<div className="flex items-center gap-3">
      {menuStep>0&&<button type="button" className="ft-guide-back inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#edf3ef] px-3 text-[13px] font-semibold text-[#253e32]" onClick={()=>moveMenu(menuStep-1)}>{t("Sebelumnya")}</button>}
      {!practice && <button type="button" className="ft-guide-next min-h-11 rounded-full bg-[#00652c] px-4 py-2 text-[12px] font-semibold text-white" onClick={()=>moveMenu(menuStep+1)}>{t(menuStep===menuSteps.length-1?"Selesai":"Lanjut")}</button>}
      </div>}
    </div>
  </aside></>, document.body);
}

export function MenuTourButton() {
  const onboarding=useOnboarding(false);
  const {t}=useLanguage();
  const router=useRouter();
  if(!onboarding)return null;
  return <button type="button" aria-label={t("Panduan menu")} className="flex min-h-12 w-full items-center justify-between gap-3 text-left transition-opacity hover:opacity-80" onClick={()=>{
    try {
      localStorage.setItem(`fintrack:menu-guide:${onboarding.userId}`,"0");
      localStorage.setItem(`fintrack:menu-guide:${onboarding.userId}:mode`,"active");
    } catch {}
    window.dispatchEvent(new Event(changeEvent));
    router.push("/dashboard");
  }}><span className="flex items-center gap-space-md"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary"><BookOpen size={20} style={{strokeWidth:1.75}} aria-hidden="true"/></span><span><span className="block font-body-lg text-body-lg font-semibold text-on-surface">{t("Panduan menu")}</span><span className="block font-body-sm text-body-sm text-on-surface-variant">{t("Kenali menu dan fitur DuitLo")}</span></span></span><ChevronRight size={20} className="shrink-0 text-primary" style={{strokeWidth:1.75}} aria-hidden="true"/></button>;
}
