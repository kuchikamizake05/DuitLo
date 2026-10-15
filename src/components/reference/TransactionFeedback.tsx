"use client";
import {getNumberFormatter} from "@/lib/intl";

import {Check, ArrowRight, Plus, Wallet, Tag, CalendarDays, FileText} from "lucide-react";
import {format} from "date-fns";
import {id,enUS} from "date-fns/locale";
import {ReferencePart,ReferenceRoot} from "./runtime";
import {ReferenceDialog} from "./ReferenceDialog";
import {DialogFrame} from "@/components/ui/DialogFrame";
import {useLanguage} from "@/components/LanguageProvider";
import type {ReferenceTransactionForm} from "./TransactionEditor";
export function TransactionResult({form,accountName,currency,edited=false,onClose,onAdd}:{form:ReferenceTransactionForm;accountName:string;currency:string;edited?:boolean;onClose:()=>void;onAdd:()=>void}){
 const {t,language}=useLanguage();const amount=getNumberFormatter(language==="en"?"en-ID":"id-ID",{style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2}).format(Number(form.amount));
 const details = [
  {icon:FileText,label:language==="en"?"Description":"Keterangan",value:form.merchant||form.category},
  {icon:Wallet,label:language==="en"?"Account":"Rekening",value:accountName},
  {icon:Tag,label:language==="en"?"Category":"Kategori",value:form.category},
  {icon:CalendarDays,label:language==="en"?"Date":"Tanggal",value:format(new Date(form.date),"d MMM yyyy",{locale:language==="en"?enUS:id})},
 ];
 return <ReferenceDialog page="hasil-transaksi" title={t("Hasil Transaksi")} onClose={onClose}>
  <main className="mx-auto w-full max-w-md px-5 pb-8 pt-24">
   <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_28px_rgba(18,53,36,.10)]" aria-labelledby="transaction-success-title">
    <div role="status" className="text-center">
     <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#d7f2e2] text-[#00652c]"><Check size={30} strokeWidth={2} aria-hidden="true"/></span>
     <h1 id="transaction-success-title" className="text-xl font-bold leading-7 text-on-surface">{t(edited?"Transaksi Berhasil Diperbarui":"Transaksi Berhasil Dicatat")}</h1>
     <p className="mt-2 text-sm leading-5 text-on-surface-variant">{t("Transaksi berhasil disimpan.")}</p>
    </div>
    <div className="mb-6 mt-7 border-b border-outline-variant/30 pb-6 text-center">
     <p className="text-xs font-medium text-on-surface-variant">{language==="en"?"Transaction amount":"Nominal transaksi"}</p>
     <p className="mt-2 break-words text-[32px] font-extrabold leading-tight tracking-tight text-primary">{amount}</p>
    </div>
    <dl className="space-y-4">{details.map(({icon:Icon,label,value})=><div key={label} className="flex items-start justify-between gap-5 text-sm"><dt className="flex shrink-0 items-center gap-2 text-on-surface-variant"><Icon size={16} aria-hidden="true"/>{label}</dt><dd className="min-w-0 break-words text-right font-semibold text-on-surface">{value}</dd></div>)}</dl>
    <div className="mt-8 flex flex-col gap-3">
     <button type="button" onClick={onClose} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary">{t("Selesai")}<ArrowRight size={18} aria-hidden="true"/></button>
     <button type="button" onClick={onAdd} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 text-sm font-semibold text-primary"><Plus size={18} aria-hidden="true"/>{t("Catat Transaksi Baru")}</button>
    </div>
   </section>
  </main>
 </ReferenceDialog>;
}
export function TransactionDelete({transaction,accountName,currency,busy,error,onClose,onConfirm}:{transaction:{merchant:string|null;category:string;amount:number;type:"income"|"expense";date:string};accountName:string;currency:string;busy:boolean;error:string|null;onClose:()=>void;onConfirm:()=>void}){
 const {t,language}=useLanguage();const amount=getNumberFormatter(language==="en"?"en-ID":"id-ID",{style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2}).format(Number(transaction.amount));
 return <DialogFrame titleId="reference-delete-transaction" onClose={onClose} closeDisabled={busy} className="!p-0 !bg-transparent" contentClassName="!h-[100svh] !max-h-none !rounded-none !bg-transparent !border-0 !shadow-none !max-w-none"><ReferenceRoot page="hapus-transaksi" contents><ReferencePart page="hapus-transaksi" part="section-1" values={{"Tindakan ini tidak dapat dibatalkan. Menghapus transaksi akan membatalkan pengaruh nominal terhadap saldo rekening terkait.":t("Transaksi akan dipindahkan ke Sampah. Saldo dan riwayat tetap dapat dipulihkan dari sana."),"Isi Bensin Pertamax":transaction.merchant||transaction.category,"Transportasi":transaction.category,"BCA Utama (Rekening Utama)":accountName,"-Rp 250.000":`${transaction.type==="income"?"+":"−"}${amount}`,"12 Okt 2026 • 14:20 WIB":format(new Date(transaction.date),"d MMM yyyy",{locale:language==="en"?enUS:id}),"Hapus Transaksi":busy?t("Menghapus..."):t("Hapus Transaksi")}} attributes={{"hapus-transaksi.36":{id:"reference-delete-transaction"},"hapus-transaksi.55":{hidden:true},"hapus-transaksi.66":{hidden:true},"hapus-transaksi.63":{disabled:busy}}} onAction={action=>{if(action==="delete-btn"||action==="confirmDelete()")onConfirm();else if(/Batal|close/.test(action))onClose();}}/>{error&&<p role="alert" className="fixed top-20 inset-x-5 z-[80] rounded-2xl bg-error-container p-3 text-error">{error}</p>}</ReferenceRoot></DialogFrame>;
}
