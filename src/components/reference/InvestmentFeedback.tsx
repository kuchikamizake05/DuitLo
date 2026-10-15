"use client";
import {getNumberFormatter} from "@/lib/intl";


import {format} from "date-fns";

import {id,enUS} from "date-fns/locale";

import {ReferencePart,ReferenceRoot} from "./runtime";

import {ReferenceDialog} from "./ReferenceDialog";

import {DialogFrame} from "@/components/ui/DialogFrame";

import {useLanguage} from "@/components/LanguageProvider";

import type {ExecutionForm} from "./InvestmentEditors";

export function InvestmentResult({form,accountName,currency,onClose,onDetail}:{form:ExecutionForm;accountName:string;currency:string;onClose:()=>void;onDetail:()=>void}){

 const {t,language}=useLanguage();const quantity=Number(form.quantity),price=Number(form.price),fee=Number(form.fee);const money=(amount:number)=>getNumberFormatter(language==="en"?"en-ID":"id-ID",{style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2}).format(amount);

 return <ReferenceDialog page="hasil-investasi" title={t("Investasi Berhasil Disimpan")} onClose={onClose}><ReferencePart page="hasil-investasi" slots={{"section-1":null,"section-4":null,"section-5":null}} values={{"Aset BBCA telah terdaftar dan saldo portofolio berhasil disinkronkan secara real-time.":t("Eksekusi berhasil disimpan di jurnal investasi."),"BBCA":form.assetName||form.ticker,"PT Bank Central Asia Tbk":accountName,"Volume Kepemilikan":t("Volume Eksekusi"),"10 Lot":`${quantity/((form.assetCategory??"stock")==="stock"&&currency==="IDR"?100:1)} ${t((form.assetCategory??"stock")==="stock"?(currency==="IDR"?"Lot":"Unit"):form.assetCategory==="gold"?"Gram":"Unit")}`,"1.000 Lembar Saham":`${quantity.toLocaleString(language==="en"?"en-ID":"id-ID")} ${t((form.assetCategory??"stock")==="stock"?"Lembar Saham":form.assetCategory==="gold"?"Gram":"Unit")}`,"Harga Rata-rata":t("Harga Eksekusi"),"Rp 8.500":money(price),"Total Nilai Pokok":t(form.side==="sell"?"Nilai Penjualan":"Nilai Pembelian"),"Rp 8.500.000":money(quantity*price),"Biaya Broker & Levy (0.15%)":t("Biaya Broker"),"Rp 12.750":money(fee),"Sumber Dana":t("Akun investasi"),"BCA Utama (IDR)":`${accountName} (${currency})`,"Terpotong Rp 8.512.750":t("Saldo rekening tidak diubah."),"Tercatat: Hari ini, 08:24:12 WIB • No. Ref: FT-202410-0982":`${t("Tercatat")}: ${format(new Date(form.executedAt),"d MMM yyyy, HH:mm",{locale:language==="en"?enUS:id})}`}} attributes={{"hasil-investasi.6":{hidden:true}}} onAction={action=>{if(/Lihat Detail/.test(action))onDetail();else if(/Kembali/.test(action))onClose();}}/></ReferenceDialog>;

}

export function InvestmentDelete({ticker,currency,quantity,value,count,execution=false,busy,error,onClose,onConfirm}:{ticker:string;currency:string;quantity:number;value:number;count:number;execution?:boolean;busy:boolean;error:string|null;onClose:()=>void;onConfirm:()=>void}){

 const {t,language}=useLanguage();const money=getNumberFormatter(language==="en"?"en-ID":"id-ID",{style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2}).format(value);

 return <DialogFrame titleId="source-delete-investment" onClose={onClose} closeDisabled={busy} className="!p-0 !bg-transparent" contentClassName="!h-[100svh] !max-h-none !max-w-none !bg-transparent !rounded-none !border-0 !shadow-none"><ReferenceRoot page="hapus-aset" contents><ReferencePart page="hapus-aset" part="section-1" slots={{"asset-delete-description":<p className="font-body-md text-body-md text-on-surface-variant text-center leading-relaxed">{execution?t("Eksekusi ini akan dihapus permanen dan posisi serta P/L akan dihitung ulang."):`${t("Catatan aset")} ${ticker} ${t("beserta")} ${count} ${t("riwayat transaksinya akan dihapus dari portofolio FinTrack.")}`}</p>}} values={{"Hapus Catatan Aset BBCA?":`${t(execution?"Hapus Eksekusi":"Hapus Catatan Aset")} ${ticker}?`,"BBCA • Bank Central Asia Tbk":ticker,"10 Lot (1.000 Lembar)":`${quantity/(currency==="IDR"?100:1)} ${t(currency==="IDR"?"Lot":"Unit")} (${quantity.toLocaleString(language==="en"?"en-ID":"id-ID")} ${t("Lembar")})`,"Nilai Terakhir":t("Modal Tercatat"),"Rp 9.000.000":money,"2 Transaksi (Beli)":`${count} ${t("Transaksi")}`,"Hapus Catatan Aset":t(execution?"Hapus Eksekusi":"Hapus Catatan Aset")}} attributes={{"hapus-aset.36":{id:"source-delete-investment"},"hapus-aset.73":{disabled:busy},"hapus-aset.76":{disabled:busy}}} onAction={action=>{if(action==="btnConfirmDelete")onConfirm();else if(action==="btnCancel")onClose();}}/>{error&&<p role="alert" className="fixed top-16 inset-x-5 z-[80] rounded-2xl bg-error-container p-3 text-error">{error}</p>}</ReferenceRoot></DialogFrame>;

}

