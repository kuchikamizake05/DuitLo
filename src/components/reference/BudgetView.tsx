"use client";
import { EmptyState } from "./EmptyState";
import {useTheme} from "@/components/ThemeProvider";
import {categoryAttributes} from "./category-palette";

import { useState } from "react";

import { addMonths, format, getDaysInMonth } from "date-fns";

import { id,enUS } from "date-fns/locale";

import { useLanguage } from "@/components/LanguageProvider";

import { ReferencePart, Symbol } from "./runtime";

import { ReferenceDialog } from "./ReferenceDialog";

import { categorySymbol } from "./DashboardView";

import {TransactionPicker} from "./TransactionPicker";

import { DialogFrame } from "@/components/ui/DialogFrame";



type Budget = {id:string;category:string;month:string;limit_amount:number};

type Progress = {spentAmount:number;limitAmount:number;percentage:number;remainingAmount:number;state:string};

export function BudgetView({items,month,setMonth,onAdd,onEdit}:{items:Array<{budget:Budget;progress:Progress}>;month:string;setMonth:(month:string)=>void;onAdd:()=>void;onEdit:(budget:Budget)=>void}) {

  const {t,language}=useLanguage();

  const {theme}=useTheme();
  const dark=theme==="dark";
  const [periodOpen,setPeriodOpen]=useState(false);

  const [descending,setDescending]=useState(false);

  const [dismissed,setDismissed]=useState(false);

  const date=new Date(`${month.slice(0,7)}-01T12:00:00`);

  const now=new Date();const days=getDaysInMonth(date);const elapsed=format(now,"yyyy-MM")===month.slice(0,7)?now.getDate():date<now?days:0;

  const total=items.reduce((sum,item)=>sum+Number(item.progress.limitAmount),0);

  const spent=items.reduce((sum,item)=>sum+item.progress.spentAmount,0);

  const percentage=total>0?Math.round(spent/total*100):0;

  const highest=[...items].sort((a,b)=>b.progress.percentage-a.progress.percentage)[0];

  const money=(amount:number)=>new Intl.NumberFormat(language==="en"?"en-ID":"id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(amount);

  const sorted=descending?[...items].sort((a,b)=>b.progress.percentage-a.progress.percentage):items;

  const rows=<div className="flex flex-col gap-space-md"><div className="flex items-center justify-between"><h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Daftar Anggaran Kategori")} <span className="text-body-sm text-on-surface-variant">{items.length} {t("Pos")}</span></h2><button type="button" onClick={()=>setDescending(!descending)} className="flex items-center gap-1 text-primary text-label-sm">{t("Urutkan")}<Symbol className="text-[18px]">swap_vert</Symbol></button></div>{sorted.map(({budget,progress})=><ReferencePart key={budget.id} page="anggaran" part="budget-card" values={{"Tagihan & Utilitas":budget.category,"Listrik, Wi-Fi, Air PDAM":t("Anggaran bulan ini"),"Mendekati Batas":t(progress.state==="over"?"Melebihi Batas":progress.state==="warning"?"Mendekati Batas":"Aman"),"Rp 2.425.000":money(progress.spentAmount),"Rp 2.500.000":money(progress.limitAmount),"97% terpakai (Sisa Rp 75.000)":`${progress.percentage.toFixed(0)}% ${t("terpakai")} (${t("Sisa")} ${money(progress.remainingAmount)})`,"icon:receipt_long":categorySymbol(budget.category)}} attributes={{[dark?"anggaran.94":"anggaran.95"]:{className:"w-full h-3 rounded-full overflow-hidden p-0.5",style:{background:"var(--ref-surface-container-highest)"}},[dark?"anggaran.78":"anggaran.79"]:{role:"button",tabIndex:0,"aria-label":`${t("Edit Anggaran")} ${budget.category}`,onClick:()=>onEdit(budget),onKeyDown:(event:React.KeyboardEvent)=>{if(event.target===event.currentTarget&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onEdit(budget);}},className:"w-full rounded-[24px] bg-surface-container-lowest p-space-lg cursor-pointer shadow-sm transition-all hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"},[dark?"anggaran.100":"anggaran.101"]:{hidden:true},[dark?"anggaran.99":"anggaran.100"]:{onClick:(event:React.MouseEvent)=>{event.stopPropagation();onEdit(budget);}},[dark?"anggaran.84":"anggaran.85"]:{className:"font-semibold text-body-lg",style:{color:"var(--color-on-surface)"}},[dark?"anggaran.86":"anggaran.87"]:{className:"text-label-sm font-semibold px-2 py-1 rounded-full",style:{color:progress.state==="over"?(dark?"#ffb4ab":"#b3261e"):progress.state==="warning"?(dark?"#f2cb72":"#855900"):(dark?"#8aceaa":"#00652c"),backgroundColor:progress.state==="over"?(dark?"#492629":"#fce8e6"):progress.state==="warning"?(dark?"#40351e":"#fff1cc"):(dark?"#203b2d":"#c5ecd2")}},[dark?"anggaran.93":"anggaran.94"]:{className:"font-bold text-body-lg",style:{color:"var(--color-on-surface)"}},[dark?"anggaran.97":"anggaran.98"]:{className:"font-medium text-label-sm",style:{color:progress.state==="over"?(dark?"#ffb4ab":"#b3261e"):progress.state==="warning"?(dark?"#f2cb72":"#855900"):(dark?"#8aceaa":"#00652c")}},[dark?"anggaran.90":"anggaran.91"]:{className:"font-bold text-body-lg",style:{color:"var(--color-on-surface)"}},[dark?"anggaran.81":"anggaran.82"]:categoryAttributes(budget.category,"w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm"),[dark?"anggaran.95":"anggaran.96"]:{className:"h-full rounded-full",style:{background:progress.percentage>=100?"var(--ref-error)":progress.percentage>=80?"#d4a544":"#0b57d0",width:`${Math.min(100,progress.percentage)}%`}}}} onAction={()=>onEdit(budget)}/>)}{!items.length&&<button onClick={onAdd} className="rounded-[32px] bg-surface-container-lowest p-6 text-primary">{t("Belum ada anggaran")} · {t("Tambah anggaran")}</button>}</div>;

  return <><ReferencePart page="anggaran" slots={{"section-3":items.length?rows:<EmptyState icon="pie_chart" title="Rencanakan pengeluaran bulan ini" description="Tentukan batas pengeluaran per kategori. Anggaran akan membantumu memantau pemakaian setelah transaksi dicatat." action="Tambah anggaran" onAction={onAdd}/>,...(!items.length?{"section-1":null,"section-4":null}:{}),...(!highest||highest.progress.percentage<90||dismissed?{"section-2":null}:{})}} values={{"Oktober 2026":format(date,"MMMM yyyy",{locale:language==="en"?enUS:id}),"Rp 7.550.000":money(total),"Rp 3.872.000":money(total-spent),[dark?"anggaran.51":"anggaran.52"]:`${money(spent)} (${percentage}%)`,"Terpakai: Rp 3.678.000 (49%)":`${t("Terpakai")}: ${money(spent)} (${percentage}%)`,"19 hari tersisa":`${Math.max(0,days-elapsed)} ${t("hari tersisa")}`,"Hari ke-12 dari 31 hari periode berjalan":`${t("Hari ke-")}${elapsed} ${t("dari")} ${days} ${t("hari periode berjalan")}`,"Rasio Stabil":t(percentage>100?"Melebihi Batas":"Rasio Stabil"),"97% Terpakai":`${highest?.progress.percentage.toFixed(0)??0}% ${t("Terpakai")}`,"Tagihan & Utilitas hampir melampaui batas yang ditetapkan":`${highest?.budget.category??""} ${t("hampir melampaui batas yang ditetapkan")}`,"Tersisa Rp 75.000 dari total pagu Rp 2.500.000.":highest?`${t("Tersisa")} ${money(highest.progress.remainingAmount)} ${t("dari total pagu")} ${money(highest.progress.limitAmount)}.`:""}}

    attributes={{"anggaran.27":{role:"button",tabIndex:0,"aria-label":t("Pilih periode"),onClick:()=>setPeriodOpen(true),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setPeriodOpen(true);}}},[dark?"anggaran.48":"anggaran.49"]:{style:{width:`${Math.min(100,percentage)}%`}}}} onAction={action=>{if(/Tambah/.test(action))onAdd();else if(/chevron_left|Bulan sebelumnya/.test(action))setMonth(format(addMonths(date,-1),"yyyy-MM"));else if(/chevron_right|Bulan berikutnya/.test(action))setMonth(format(addMonths(date,1),"yyyy-MM"));else if(/Oktober 2026/.test(action))setPeriodOpen(true);else if(/Sesuaikan/.test(action)&&highest)onEdit(highest.budget);else if(action==="Abaikan")setDismissed(true);}}/>

    {periodOpen&&<DialogFrame titleId="budget-period-title" onClose={()=>setPeriodOpen(false)}><div className="p-5"><h2 id="budget-period-title">{t("Pilih periode")}</h2><input aria-label={t("Periode")} type="month" value={month.slice(0,7)} onChange={event=>{if(event.target.value){setMonth(event.target.value);setPeriodOpen(false);}}} className="mt-4 w-full rounded-2xl border p-3"/></div></DialogFrame>}

  </>;

}



export function BudgetEditor({form,setForm,categories,busy,error,onSave,onClose,onDelete,spentAmount,isNew=false}:{isNew?:boolean;form:{category:string;month:string;limitAmount:string};setForm:(form:{category:string;month:string;limitAmount:string})=>void;categories:string[];busy:boolean;error:string|null;onSave:(event:React.FormEvent<HTMLFormElement>)=>void;onClose:()=>void;onDelete?:()=>void;spentAmount:number}) {

  const {t,language}=useLanguage();const [chooseCategory,setChooseCategory]=useState(false);const [initialForm]=useState(()=>({...form}));

  const date=new Date(`${form.month.slice(0,7)}-01T12:00:00`),now=new Date(),days=getDaysInMonth(date),elapsed=format(now,"yyyy-MM")===form.month.slice(0,7)?now.getDate():date<now?days:0;

  const limit=Number(form.limitAmount)||0,remaining=limit-spentAmount,percentage=limit>0?spentAmount/limit*100:0;

  const money=(value:number)=>`Rp ${Math.round(value).toLocaleString(language==="en"?"en-ID":"id-ID")}`;

  if(isNew)return <DialogFrame titleId="new-budget-title" onClose={onClose} closeDisabled={busy}><div className="p-5"><form onSubmit={event=>{event.preventDefault();if(!busy)onSave(event);}} className="flex flex-col gap-5"><h1 id="new-budget-title" className="text-headline-sm font-bold text-on-surface">{t("Tambah anggaran")}</h1><div><label className="block mb-2 text-label-sm text-on-surface-variant">{t("Kategori")}</label><button type="button" disabled={busy} onClick={()=>setChooseCategory(true)} className="w-full rounded-2xl bg-surface-container-low p-4 text-left text-on-surface flex items-center justify-between gap-3"><span>{form.category||t("Pilih Kategori")}</span><Symbol className="text-[20px] text-on-surface-variant">expand_more</Symbol></button></div><div><label htmlFor="new-budget-month" className="block mb-2 text-label-sm text-on-surface-variant">{t("Periode")}</label><input id="new-budget-month" type="month" required disabled={busy} value={form.month.slice(0,7)} onChange={event=>setForm({...form,month:event.target.value})} className="w-full rounded-2xl bg-surface-container-low p-4 text-on-surface"/></div><div><label htmlFor="new-budget-amount" className="block mb-2 text-label-sm text-on-surface-variant">{t("Jumlah Anggaran")}</label><div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4"><span className="text-on-surface-variant">Rp</span><input id="new-budget-amount" placeholder="0" inputMode="numeric" required disabled={busy} value={form.limitAmount?Number(form.limitAmount).toLocaleString(language==="en"?"en-ID":"id-ID"):""} onChange={event=>setForm({...form,limitAmount:event.target.value.replace(/\D/g,"")})} className="w-full bg-transparent text-on-surface outline-none"/></div></div>{error&&<p role="alert" className="text-error">{error}</p>}<div className="flex gap-3"><button type="button" disabled={busy} onClick={onClose} className="flex-1 rounded-full bg-surface-container p-3 font-semibold text-on-surface">{t("Batal")}</button><button type="submit" disabled={busy||!form.category||Number(form.limitAmount)<=0||!form.month} className="flex-[2] rounded-full bg-primary-container p-3 font-semibold text-white disabled:opacity-50" style={{color:"#fff"}}>{t(busy?"Menyimpan...":"Simpan Anggaran")}</button></div></form></div>{chooseCategory&&<TransactionPicker kind="category" accounts={[]} categories={categories} accountId="" category={form.category} type="expense" onType={()=>{}} onChoose={value=>{setForm({...form,category:value});setChooseCategory(false);}} onClose={()=>setChooseCategory(false)}/>}</DialogFrame>;
  return <ReferenceDialog page="edit-anggaran" title={t("Edit Anggaran")} onClose={onClose} busy={busy}><ReferencePart page="edit-anggaran" fields={{"budget-limit":{value:form.limitAmount?Number(form.limitAmount).toLocaleString(language==="en"?"en-ID":"id-ID"):"",onChange:value=>setForm({...form,limitAmount:value.replace(/\D/g,"")}),disabled:busy}}} values={{"edit-anggaran.22":`${format(date,"MMMM yyyy",{locale:language==="en"?enUS:id})} (${elapsed} ${t("dari")} ${days} ${t("hari")})`,"edit-anggaran.32":money(spentAmount),"edit-anggaran.44":t(percentage>=100?"Melebihi Batas":percentage>=80?"Mendekati Batas":"Normal"),"edit-anggaran.38":`${percentage.toFixed(1)}% ${t("terpakai")}`,"edit-anggaran.40":`${money(remaining)} ${t("tersisa")}`,"edit-anggaran.61":elapsed?`${money(spentAmount/elapsed)}/${t("hari")}`:"—","edit-anggaran.62":days>elapsed?`${money(Math.max(0,remaining)/(days-elapsed))}/${t("hari")}`:"—","Makanan & Minuman":form.category||t("Pilih Kategori"),"Rp 2.000.000":form.limitAmount?`Rp ${Number(form.limitAmount).toLocaleString(language==="en"?"en-ID":"id-ID")}`:"Rp 0","Oktober 2026":form.month?format(new Date(`${form.month.slice(0,7)}-01T12:00:00`),"MMMM yyyy",{locale:language==="en"?enUS:id}):"—"}} onSubmit={event=>{if(!busy)onSave(event);}}

    slots={{"section-2":null,"section-4":null}} attributes={{"edit-anggaran.14":{hidden:true},"edit-anggaran.24":{hidden:true},"edit-anggaran.17":categoryAttributes(form.category,"w-12 h-12 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"),"edit-anggaran.76":{hidden:true},"edit-anggaran.78":{hidden:true},"edit-anggaran.88":{hidden:true},"edit-anggaran.83":{hidden:true},"edit-anggaran.85":{disabled:true},"edit-anggaran.86":{disabled:true},"edit-anggaran.87":{disabled:true},"edit-anggaran.91":{hidden:true},"edit-anggaran.92":{hidden:true},"edit-anggaran.36":{className:"h-full rounded-full transition-all duration-700 ease-out",style:{background:percentage>=100?"var(--ref-error)":percentage>=80?"#d4a544":"#0b57d0",width:`${Math.min(100,Math.max(0,percentage))}%`}},"edit-anggaran.148":{disabled:busy}}} onAction={action=>{if(busy)return;if(/Simpan|save/i.test(action))onSave({preventDefault(){}} as React.FormEvent<HTMLFormElement>);else if(/Hapus|delete/i.test(action))onDelete?.();else if(/Makanan|Kategori/.test(action)||action==="edit")setChooseCategory(true);else if(/handleResetBudget/.test(action))setForm({...initialForm});else if(/Batal|Kembali/.test(action))onClose();}}/>{error&&<p role="alert" className="px-margin pb-24 text-error">{error}</p>}

    {chooseCategory&&<TransactionPicker kind="category" accounts={[]} categories={categories} accountId="" category={form.category} type="expense" onType={()=>{}} onChoose={value=>{setForm({...form,category:value});setChooseCategory(false);}} onClose={()=>setChooseCategory(false)}/>}



  </ReferenceDialog>;

}

