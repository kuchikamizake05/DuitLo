"use client";

import {useState} from "react";

import {format,differenceInCalendarDays} from "date-fns";

import {id,enUS} from "date-fns/locale";

import {decodeInvestmentNote,type buildInvestmentPositions,type InvestmentExecution} from "@/lib/investments";

import {ReferencePart} from "./runtime";

import {ReferenceDialog} from "./ReferenceDialog";

import {useLanguage} from "@/components/LanguageProvider";

type Position=ReturnType<typeof buildInvestmentPositions>[number];

export function InvestmentDetail({position,executions,accountName,totalCost,onClose,onTrade,onEdit,onDelete}:{position:Position;executions:InvestmentExecution[];accountName:string;totalCost:number;onClose:()=>void;onTrade:(side:"buy"|"sell")=>void;onEdit:(execution:InvestmentExecution)=>void;onDelete:()=>void}){

 const {t,language}=useLanguage();const [period,setPeriod]=useState("Semua");const trades=executions.filter(item=>item.account_id===position.accountId&&item.ticker===position.ticker).sort((a,b)=>a.executed_at.localeCompare(b.executed_at));const first=trades[0];const metadata=decodeInvestmentNote(first?.note);const isStock=metadata.category==="stock";const factor=isStock&&position.currency==="IDR"?100:1;const unit=isStock?(factor===100?"Lot":"Unit"):metadata.category==="gold"?"Gram":"Unit";const money=(amount:number)=>new Intl.NumberFormat(language==="en"?"en-ID":"id-ID",{style:"currency",currency:position.currency,maximumFractionDigits:position.currency==="IDR"?0:2}).format(amount);

 const months=period==="1M"?1:period==="3M"?3:period==="6M"?6:period==="1T"?12:null;const start=new Date();if(months)start.setMonth(start.getMonth()-months);const points=trades.filter(item=>!months||new Date(item.executed_at)>=start);const max=Math.max(...points.map(item=>item.price),1),min=Math.min(...points.map(item=>item.price),0);const coords=points.map((item,index)=>`${points.length>1?index/(points.length-1)*320:160},${120-(item.price-min)/(max-min||1)*100}`).join(" ");

 const chart=<div className="relative w-full h-40 pt-2">{points.length?<><svg viewBox="0 0 320 140" className="w-full h-32" role="img" aria-label={t("Riwayat harga eksekusi")}><polyline points={coords} fill="none" stroke="var(--ref-primary)" strokeWidth="3" strokeLinejoin="round"/>{points.length===1&&<circle cx="160" cy="20" r="4" fill="var(--ref-primary)"/>}</svg><div className="flex justify-between text-label-sm text-on-surface-variant"><span>{format(new Date(points[0].executed_at),"d MMM yyyy",{locale:language==="en"?enUS:id})}</span><span>{format(new Date(points.at(-1)!.executed_at),"d MMM yyyy",{locale:language==="en"?enUS:id})}</span></div></>:<p className="text-body-sm text-on-surface-variant">{t("Belum ada eksekusi pada periode ini.")}</p>}</div>;

 const rows=trades.toReversed().map(item=><ReferencePart key={item.id} page="detail-aset" part="asset-trade" values={{"Beli Tambahan":t(item.side==="buy"?"Beli":"Jual"),"5 Lot":`${item.quantity/(factor)} ${t(unit)}`,"12 Okt 2026 • @ Rp 8.600 • BCA Utama":`${format(new Date(item.executed_at),"d MMM yyyy",{locale:language==="en"?enUS:id})} • @ ${money(item.price)} • ${accountName}`,"-Rp 4.300.000":`${item.side==="buy"?"−":"+"}${money(item.quantity*item.price+(item.side==="buy"?item.fee:-item.fee))}`}} attributes={{"detail-aset.105":{role:"button",tabIndex:0,onClick:()=>onEdit(item),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==="Enter")onEdit(item);}}}}/>);

 return <ReferenceDialog page="detail-aset" title={position.ticker} onClose={onClose} onMenu={onDelete}><ReferencePart page="detail-aset" slots={{"asset-history-chart":chart,"asset-trades":rows}} values={{"IDX : BBCA":metadata.name||position.ticker,"Saham Terbuka • Manual Entry":t("Saham • Jurnal Eksekusi"),"Nilai Sekarang":t("Modal Posisi"),"IDR":position.currency,"Rp 9.000.000":money(position.summary.costBasis),"+Rp 500.000 (+5,88%)":"—","Modal: Rp 8.500.000":`${t("Modal")}: ${money(position.summary.costBasis)}`,"Harga manual per lembar:":t("Rata-rata harga beli:"),"Rp 9.000":money(position.summary.averageCost),"• Terakhir diperbarui: 12 Okt 2026, 09:15 WIB":"","(Bukan harga real-time)":t("Harga pasar belum tersedia"),"Perbarui Harga":t("Catat Eksekusi"),"Edit Informasi Aset":t("Edit Eksekusi Terakhir"),"Kinerja Portofolio":t("Riwayat Harga Eksekusi"),"Pertumbuhan nilai akumulasi":t("Harga transaksi yang tercatat"),"Konsisten":"","10 Lot":`${position.summary.quantity/(factor)} ${t(unit)}`,"(1.000 Lembar)":`(${position.summary.quantity.toLocaleString(language==="en"?"en-ID":"id-ID")} ${t(isStock?"Lembar":unit)})`,"Rp 8.500":money(position.summary.averageCost),"21,2%":`${totalCost>0?(position.summary.costBasis/totalCost*100).toFixed(1):0}%`,"15 Agu 2026":first?format(new Date(first.executed_at),"d MMM yyyy",{locale:language==="en"?enUS:id}):"—","58 hari dipegang":first?`${differenceInCalendarDays(new Date(),new Date(first.executed_at))} ${t("hari dipegang")}`:"—","2 catatan beli • 0 penjualan":`${trades.filter(item=>item.side==="buy").length} ${t("Beli")} • ${trades.filter(item=>item.side==="sell").length} ${t("Jual")}`}} attributes={{"detail-aset.50":{hidden:true}}} onAction={action=>{if(/arrow_back|history.back/.test(action))onClose();else if(action==="quickUpdateBtn"||/Beli Lagi/.test(action))onTrade("buy");else if(/Catat Penjualan/.test(action))onTrade("sell");else if(/Edit Informasi/.test(action)&&trades.at(-1))onEdit(trades.at(-1)!);else if(["1M","3M","6M","1T","Semua"].includes(action))setPeriod(action);}}/></ReferenceDialog>;

}

