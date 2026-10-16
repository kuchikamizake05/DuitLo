"use client";
import {getNumberFormatter} from "@/lib/intl";


import { useState, type FormEvent } from "react";

import { differenceInCalendarDays, differenceInCalendarMonths, format } from "date-fns";

import { id,enUS } from "date-fns/locale";

import { ReferencePart } from "./runtime";

import { ReferenceDialog } from "./ReferenceDialog";

import { useLanguage } from "@/components/LanguageProvider";

import type { ReferenceGoal } from "./GoalsView";

import { parseMoney, formatMoneyInput } from "./AccountEditors";



export type ReferenceGoalForm={name:string;targetAmount:string;currentAmount:string;currency:string;dueDate:string};

export function GoalEditor({form,setForm,busy,error,onSave,onClose,editing=false}:{form:ReferenceGoalForm;setForm:(form:ReferenceGoalForm)=>void;busy:boolean;error:string|null;onSave:(event:FormEvent<HTMLFormElement>)=>void;onClose:()=>void;editing?:boolean}) {

  const {t,language}=useLanguage();const [icon,setIcon]=useState("laptop_mac");const [category,setCategory]=useState("Produktivitas");

  const [reminder,setReminder]=useState(false);

  const money=(value:number)=>getNumberFormatter("id-ID",{style:"currency",currency:form.currency,maximumFractionDigits:form.currency==="IDR"?0:2}).format(value);

  const remaining=Math.max(0,Number(form.targetAmount||0)-Number(form.currentAmount||0));

  const months=form.dueDate?Math.max(1,differenceInCalendarMonths(new Date(form.dueDate),new Date())):null;

  const attrs:Record<string,Record<string,unknown>>={"tambah-target.121":{disabled:busy},"tambah-target.75":{hidden:!editing}};

  ["laptop_mac","home","flight_takeoff","directions_car","shield_with_heart","school"].forEach((name,index)=>attrs[`tambah-target.${34+index*2}`]={"aria-pressed":icon===name,className:`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${icon===name?"bg-primary text-on-primary shadow-sm":"bg-surface-container text-on-surface-variant"}`});

  return <ReferenceDialog page="tambah-target" title={t("Mulai Target Tabungan")} onClose={onClose} busy={busy}><ReferencePart page="tambah-target" values={{"Produktivitas":category,"Tersedia Rp 12.500.000":"","BCA Utama":t("Pencatatan saldo target"),"Rp 14.000.000":money(remaining),"Rp 4.667.000":months?money(remaining/months):"—","(tgl 25)":"","Target realistis berdasarkan pola kas bulan lalu":t("Perkiraan berdasarkan target dan tanggal yang dipilih")}}

    fields={{goalName:{value:form.name,onChange:value=>setForm({...form,name:value}),disabled:busy},goalAmount:{value:formatMoneyInput(form.targetAmount,form.currency),onChange:value=>setForm({...form,targetAmount:parseMoney(value,form.currency)}),disabled:busy},initialDeposit:{value:formatMoneyInput(form.currentAmount,form.currency),onChange:value=>setForm({...form,currentAmount:parseMoney(value,form.currency)}),disabled:busy||editing},noDeadlineToggle:{value:!form.dueDate,onChange:value=>setForm({...form,dueDate:value==="true"?"":format(new Date(new Date().getFullYear(),new Date().getMonth()+3,new Date().getDate()),"yyyy-MM-dd")}),disabled:busy},targetDate:{value:form.dueDate,onChange:value=>setForm({...form,dueDate:value}),disabled:busy||!form.dueDate},paydayToggle:{value:reminder,onChange:value=>setReminder(value==="true"),disabled:busy}}}

    attributes={attrs} onSubmit={event=>{if(!busy)onSave(event);}} slots={{"section-0":<div className="mb-5"><h1 className="text-headline-sm font-bold text-on-surface">{t("Tambah Target Tabungan")}</h1><p className="mt-1 text-body-sm text-on-surface-variant">{t("Tentukan target dan rencana menabungmu.")}</p></div>}}

    onAction={action=>{if(busy)return;if(/selectIcon/.test(action)){const selected=/selectIcon\(this, '([^']+)', '([^']+)'/.exec(action);if(selected){setIcon(selected[1]);setCategory(selected[2]);}}else if(/setGoalAmount/.test(action)){const selected=/setGoalAmount\('([^']+)'/.exec(action)?.[1];if(selected)setForm({...form,targetAmount:parseMoney(selected)});}else if(/location.assign|Batal/.test(action))onClose();}}/>

    {error&&<p role="alert" className="fixed top-16 inset-x-5 z-[70] rounded-2xl bg-error-container p-3 text-error">{error}</p>}

  </ReferenceDialog>;

}



export type GoalDeposit={id:string;goal_id:string;account_id:string;amount:number;currency:string;created_at:string;account?:{name:string}|null};
export function GoalDetail({goal,onEdit,onClose,onArchive,onDeposit,busy,error,sources,deposits=[],pending=null}:{sources:Array<{id:string;name:string;currency:string;current_balance:number}>;onDeposit:(amount:number,accountId:string)=>Promise<boolean>;busy:boolean;error:string|null;goal:ReferenceGoal;onEdit:()=>void;onClose:()=>void;onArchive:()=>void;deposits?:GoalDeposit[];pending?:Record<string,string|number|boolean|null>|null}) {

  const {t,language}=useLanguage();const [deposit,setDeposit]=useState(()=>pending?String(pending.amount):"");const [notes,setNotes]=useState("");const [notice,setNotice]=useState(false);const [sourceId,setSourceId]=useState(()=>pending?String(pending.account_id):"");
  const submitDeposit=async()=>{const amount=Number(deposit);if(!busy&&amount>0&&sourceId&&await onDeposit(amount,sourceId)){setDeposit("");setNotes("");setNotice(true);}};

  const money=(value:number)=>getNumberFormatter("id-ID",{style:"currency",currency:goal.currency,maximumFractionDigits:goal.currency==="IDR"?0:2}).format(value);

  const saved=Number(goal.current_amount),target=Number(goal.target_amount),percentage=target>0?Math.min(100,Math.round(saved/target*100)):0;

  const months=goal.due_date?Math.max(0,differenceInCalendarMonths(new Date(goal.due_date),new Date())):null;

  return <ReferenceDialog page="detail-target" title={goal.name} onClose={onClose} busy={busy}><ReferencePart page="detail-target" values={{"Laptop Kerja Baru":<>{goal.name}<button type="button" onClick={onEdit} aria-label={t("Ubah Rencana")} title={t("Ubah Rencana")} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary hover:shadow-md active:scale-95"><span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span></button></>,'MacBook Pro 14" M3 Pro • Ruang Kerja Produktif':t("Target Tabungan"),"Kebutuhan Kerja Q4":goal.currency,"40% Tercapai":`${percentage}% ${t("Tercapai")}`,"Rp 7.200.000":money(saved),"/ Rp 18.000.000":`/ ${money(target)}`,"Rp 10.800.000":money(Math.max(0,target-saved)),"detail-target.37":`${money(Math.max(0,target-saved))} ${t("lagi")}`,"detail-target.44":goal.due_date?`${Math.max(0,differenceInCalendarDays(new Date(goal.due_date),new Date()))} ${t("hari lagi")}`:t("Tanpa tenggat"),"detail-target.47":months===null?"—":money(Math.max(0,target-saved)/Math.max(1,months)),"1 Jan 2027":goal.due_date?format(new Date(goal.due_date),"d MMM yyyy",{locale:language==="en"?enUS:id}):t("Tanpa tenggat"),"3 Bulan Lagi":months===null?t("Tanpa tenggat"):`${months} ${t("Bulan Lagi")}`,"BCA Utama • Rek. Pribadi":<select aria-label={t("Rekening Sumber")} value={sourceId} disabled={busy} onChange={event=>setSourceId(event.target.value)} className="w-full bg-transparent text-on-surface"><option value="">{t("Pilih akun")}</option>{sources.filter(item=>item.currency===goal.currency).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>,"Saldo aktif: Rp 14.500.000":money(saved),"BCA":goal.currency}}

    attributes={{"detail-target.33":{className:"w-full h-3 rounded-full overflow-hidden p-0.5 mt-1",style:{background:"var(--ref-surface-container-highest)"}},"detail-target.15":{className:"flex items-center gap-space-sm pr-12"},"detail-target.49":{hidden:true},"detail-target.86":{disabled:busy||Number(deposit)<=0||!sourceId},"detail-target.81":{hidden:true},"detail-target.34":{style:{width:`${percentage}%`}}}} fields={{"nominal-input":{value:formatMoneyInput(deposit,goal.currency),onChange:value=>setDeposit(parseMoney(value,goal.currency)),disabled:busy},"notes-input":{value:notes,onChange:setNotes}}}

    slots={{"section-2":<section className="mt-5 rounded-[24px] bg-surface-container-lowest p-5 shadow-sm"><form className="flex flex-col gap-4" onSubmit={event=>{event.preventDefault();void submitDeposit();}}><h3 className="text-headline-sm font-bold">{t("Form Cepat Setor Dana")}</h3><label className="text-body-sm text-on-surface-variant">{t("Nominal Setoran")}<div className="mt-2 rounded-2xl bg-surface-container-low flex items-center gap-3 p-3"><span>{goal.currency==="IDR"?"Rp":goal.currency}</span><input id="nominal-input" inputMode="decimal" required disabled={busy} value={formatMoneyInput(deposit,goal.currency)} onChange={event=>setDeposit(parseMoney(event.target.value,goal.currency))} className="w-full bg-transparent text-on-surface text-[24px] font-semibold outline-none"/></div></label><div className="flex gap-2">{[100000,500000,1000000].map(value=><button key={value} type="button" disabled={busy} onClick={()=>setDeposit(String(value))} className="flex-1 rounded-full bg-surface-container py-2 text-label-sm text-primary font-semibold">+{money(value)}</button>)}</div><label className="text-body-sm text-on-surface-variant">{t("Rekening Sumber Dana")}<select required value={sourceId} disabled={busy} onChange={event=>setSourceId(event.target.value)} className="mt-2 w-full rounded-2xl bg-surface-container-low p-3 text-on-surface"><option value="">{t("Pilih akun")}</option>{sources.filter(item=>item.currency===goal.currency).map(item=><option key={item.id} value={item.id}>{item.name} · {money(Number(item.current_balance))}</option>)}</select></label><p className="text-body-sm text-on-surface-variant">{t("Setoran mengurangi saldo rekening sumber.")}</p>{error&&<p role="alert" className="text-error">{error}</p>}<button type="submit" disabled={busy||!sourceId||Number(deposit)<=0} className="rounded-full bg-primary-container py-3 font-semibold disabled:opacity-50" style={{color:"#fff"}}>{t(busy?"Menyimpan...":"Konfirmasi Setoran")}</button></form></section>,"section-3":null,"section-4":<section className="mt-space-xl flex flex-col gap-space-md"><div className="flex items-center justify-between"><h2 className="font-headline-sm text-headline-sm font-bold">{t("Riwayat Alokasi Dana")}</h2><button onClick={onArchive} className="text-label-sm text-primary">{t("Arsipkan")}</button></div><div className="flex flex-col gap-3">{deposits.length?deposits.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3"><div><p className="text-body-sm font-semibold">{item.account?.name??sources.find(source=>source.id===item.account_id)?.name??item.account_id}</p><time dateTime={item.created_at} className="text-body-sm text-on-surface-variant">{format(new Date(item.created_at),"d MMM yyyy, HH:mm",{locale:language==="en"?enUS:id})}</time></div><span className="font-semibold text-primary">+{money(Number(item.amount))}</span></div>):<p className="text-body-sm text-on-surface-variant">{t("Belum ada alokasi dana tercatat.")}</p>}</div></section>}}

    onAction={action=>{if(/Ubah Rencana/.test(action))onEdit();else if(/setNominal/.test(action)){const value=/setNominal\('([^']+)'/.exec(action)?.[1];if(value)setDeposit(parseMoney(value,goal.currency));}else if(/Konfirmasi Setoran/.test(action))void submitDeposit();else if(/openDeposit/.test(action)){document.getElementById("nominal-input")?.scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("nominal-input")?.focus();}}}/>

    {error&&<p role="alert" className="mx-margin text-error">{error}</p>}
    {notice&&<p role="status" className="mx-margin text-primary">{t("Setoran tersimpan.")}</p>}
    {pending&&<button type="button" disabled={busy} className="mx-margin mt-3 rounded-full bg-surface-container px-4 py-3 text-primary font-semibold" onClick={()=>{setDeposit(String(pending.amount));setSourceId(String(pending.account_id));}}>{t("Pulihkan setoran sebelumnya")}</button>}

  </ReferenceDialog>;

}
