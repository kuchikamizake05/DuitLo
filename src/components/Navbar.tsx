"use client";
import { FirstStepsGuide } from "./FirstStepsGuide";
import { ReceiptPhotoControls } from "@/components/ReceiptPhotoControls";

import {Camera,FilePenLine} from "lucide-react";
import {DialogFrame} from "@/components/ui/DialogFrame";
import {supabase} from "@/infrastructure/supabase/browser-client";
import type {ReceiptExtraction} from "@/lib/receipt-vision";
import {setPendingReceipt,setPendingExtraction} from "@/lib/pending-receipt";
import { useLanguage } from "@/components/LanguageProvider";
import { QuickTransactionDialog } from "@/components/QuickTransactionDialog";
import { useTheme } from "@/components/ThemeProvider";
import { usePathname,useRouter } from "next/navigation";
import { useEffect,useRef,useState } from "react";
import { ReferencePart,ReferenceRoot,useReferencePage,type ReferencePage } from "./reference/runtime";
import navigationContainers from "./reference/navigation-containers.json";
import shellNodes from "./reference/shell-nodes.json";

const pageRoutes: Record<string, ReferencePage> = {
  "/dashboard": "beranda", "/accounts": "dompet", "/transactions": "aktivitas",
  "/insights": "laporan", "/reports": "laporan-klasik", "/settings": "pengaturan",
  "/planning": "anggaran", "/goals": "target", "/investments": "portofolio",
};

export default function Navbar({ onBack, onMenu }: { onBack?: () => void; onMenu?:()=>void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const parentPage = useReferencePage();
  const page = parentPage ?? pageRoutes[pathname] ?? "beranda";
  const { language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickMenu,setQuickMenu]=useState(false);
  useEffect(()=>{
    const closeMenu=()=>setQuickMenu(false);
    window.addEventListener("fintrack:guide-close-menu",closeMenu);
    return()=>window.removeEventListener("fintrack:guide-close-menu",closeMenu);
  },[]);
  const [photoChoice,setPhotoChoice]=useState(false);const [photoBusy,setPhotoBusy]=useState(false);const [photoError,setPhotoError]=useState("");const cameraFile=useRef<HTMLInputElement>(null);const galleryFile=useRef<HTMLInputElement>(null);
  const {t}=useLanguage();
  const quickTriggerRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(quickOpen||!quickTriggerRef.current)return;const timer=window.setTimeout(()=>quickTriggerRef.current?.focus(),0);return()=>window.clearTimeout(timer);},[quickOpen]);
  const nodes = shellNodes[page];
  const headerPage=page==="detail-rekening"||page==="detail-target"||page==="tambah-target"?"detail":page;
  const headerNodes=shellNodes[headerPage];
  const navigationName=page==="portofolio"?"dompet":page==="laporan-klasik"?"laporan":page;
  const targetIndex=["beranda","dompet","catat","aktivitas","laporan"].indexOf(navigationName);
  const attributes: Record<string, Record<string, unknown>> = {};
  for (const [code, key] of Object.entries(headerNodes.languages)) {
    const selected = language === code.toLowerCase();
    attributes[key] = {
      "aria-pressed": selected,
      style: { width: 30, height: 30, borderRadius: 999, fontSize: 10, fontWeight: 900,
        color: selected ? (theme === "dark" ? "#16417d" : "#79db8d") : (theme === "dark" ? "#96969f" : "#758b80"),
        background: selected ? (theme === "dark" ? "#a8c4fc" : "#123524") : "transparent" },
    };
  }
  const navigationKey=(key:string)=>{if(page!=="portofolio"||theme!=="dark")return key;const [name,index]=key.split(".");return `${name}.${Number(index)-1}`;};
  const active = page === "portofolio" ? "dompet" : page === "laporan-klasik" ? "laporan" : page;
  for (const [name, sourceKey] of Object.entries(nodes.navigation)) {
    const key=navigationKey(sourceKey);
    attributes[key] = { "aria-current": name === active ? "page" : undefined,
      ...(name === active ? {className:"flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 rounded-full text-primary font-bold transition-colors"} : {}),
      ...(name === "catat" ? {onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {event.preventDefault();quickTriggerRef.current=event.currentTarget;setQuickMenu(current=>!current);}} : {}),
    };
  }
  const navContainer=navigationContainers[page]?.[theme];
  if(navContainer)attributes[navContainer]={"data-moving-indicator":true,style:{"--nav-index":Math.max(0,targetIndex),"--nav-visible":targetIndex<0?0:1}};
  const addKey="catat" in nodes.navigation?navigationKey(nodes.navigation.catat):undefined;
  if(addKey){const [name,index]=addKey.split(".");attributes[`${name}.${Number(index)+1}`]={style:{fontWeight:700,fontVariationSettings:'"wght" 700',WebkitTextStroke:"0.8px currentColor"}};}
  if(onBack&&page==="catat")attributes["catat.3"]={onClick:onBack};
  function action(value: string) {
    if (value.endsWith(":ID")) setLanguage("id");
    else if (value.endsWith(":EN")) setLanguage("en");
    else if (value === "more_vert") onMenu?.();
    else if (value === "Profil Akun" || /fintrack-pengaturan-reference/.test(value)) router.push("/settings");
    else if (/Kembali|Tutup|arrow_back|history.back|location.assign|location.href/.test(value)) {
      if (onBack) onBack();
      else router.push(page==="target"?"/dashboard":page==="portofolio"?"/accounts":page==="edit-anggaran"?"/planning":/target/.test(page)?"/goals":/aset|investasi/.test(page)?"/investments":/rekening|akun|transfer|anggaran/.test(page)?"/accounts":"/dashboard");
    }
  }
  async function choosePhoto(file:File|undefined){if(!file||photoBusy)return;setPhotoBusy(true);setPhotoError("");try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error(t("Masuk kembali untuk melanjutkan."));const body=new FormData();body.append("file",file);const response=await fetch("/api/receipts/parse",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},body});const result=await response.json() as {extraction?:ReceiptExtraction;error?:string};if(!response.ok||!result.extraction)throw new Error(result.error||t("Struk belum dapat dibaca."));setPendingReceipt(file);setPendingExtraction(result.extraction);setPhotoChoice(false);router.push("/transactions?new=1&receipt=1");}catch(error){setPhotoError(error instanceof Error?error.message:t("Struk belum dapat dibaca."));}finally{setPhotoBusy(false);}}
  const shell = <><input ref={cameraFile} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event=>{choosePhoto(event.target.files?.[0]);event.target.value="";}}/><input ref={galleryFile} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{choosePhoto(event.target.files?.[0]);event.target.value="";}}/>{photoChoice&&<DialogFrame titleId="navbar-photo-title" onClose={()=>setPhotoChoice(false)} closeDisabled={photoBusy}><div className="p-5 flex flex-col gap-4"><h2 id="navbar-photo-title" className="text-headline-sm font-bold">{t("Foto struk")}</h2><p className="text-body-sm text-on-surface-variant">{t("Pilih kamera atau galeri untuk membaca struk.")}</p><ReceiptPhotoControls busy={photoBusy} onCamera={()=>cameraFile.current?.click()} onGallery={()=>galleryFile.current?.click()} cameraLabel={t("Kamera")} galleryLabel={t("Galeri")} loadingLabel={t("Membaca struk...")} />{photoError&&<p role="alert" className="text-body-sm text-error">{photoError}</p>}</div></DialogFrame>}
<ReferencePart page={headerPage} part="header" attributes={attributes} onAction={action}/><ReferencePart key={`navigation-${targetIndex}`} page={page} part="navigation" values={{"icon:add":quickMenu?"close":"add"}} attributes={attributes} onAction={action}/>{quickMenu&&<><button type="button" aria-label={t("Tutup")} onClick={()=>setQuickMenu(false)} className="fixed inset-0 z-[49] bg-black/25"/><div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[55] flex items-end gap-6 pb-4"><button type="button" aria-label={t("Catat manual")} title={t("Catat manual")} onClick={()=>{setQuickMenu(false);setQuickOpen(true);}} className="w-12 h-12 rounded-full bg-[#087f8c] text-white shadow-lg flex items-center justify-center"><FilePenLine aria-hidden="true" className="w-6 h-6" strokeWidth={1.75} style={{strokeWidth:1.75}}/></button><button type="button" aria-label={t("Foto struk")} title={t("Foto struk")} onClick={()=>{setQuickMenu(false);setPhotoChoice(true);}} className="w-12 h-12 rounded-full bg-[#056893] text-white shadow-lg flex items-center justify-center"><Camera aria-hidden="true" className="w-6 h-6" strokeWidth={1.75} style={{strokeWidth:1.75}}/></button></div></>}{quickOpen && <QuickTransactionDialog onClose={() => setQuickOpen(false)}/>}</>;
  const guidedShell = <>{shell}{!onBack && Object.keys(nodes.navigation).length>0 && <FirstStepsGuide/>}</>;
  return parentPage ? guidedShell : <ReferenceRoot page={page} contents>{guidedShell}</ReferenceRoot>;
}
