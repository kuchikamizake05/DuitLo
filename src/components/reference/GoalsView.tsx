"use client";
import { EmptyState } from "./EmptyState";
import { useState } from "react";
import { format, differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";
import { id,enUS } from "date-fns/locale";
import { ReferencePart } from "./runtime";
import { useLanguage } from "@/components/LanguageProvider";

export type ReferenceGoal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; due_date: string | null; is_active: boolean };
export function GoalsView({ goals, onAdd, onDetail,onQuickSave }: {onQuickSave:(goal:ReferenceGoal)=>void; goals: ReferenceGoal[]; onAdd: () => void; onDetail: (goal: ReferenceGoal) => void }) {
  const { t ,language}=useLanguage();
  const [filter,setFilter] = useState("all");
  const active = goals.filter(goal=>goal.is_active);
  const currencies = [...new Set(active.map(goal=>goal.currency))];
  const code = currencies[0]??"IDR";
  const money = (amount:number,currency=code)=>new Intl.NumberFormat(language==="en"?"en-ID":"id-ID",{style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2}).format(amount);
  const group = active.filter(goal=>goal.currency===code);
  const saved = group.reduce((sum,goal)=>sum+Number(goal.current_amount),0);
  const target = group.reduce((sum,goal)=>sum+Number(goal.target_amount),0);
  const percentage = target>0?Math.min(100,saved/target*100):0;
  const nearest = active.filter(goal=>goal.due_date).sort((a,b)=>a.due_date!.localeCompare(b.due_date!))[0];
  const filtered = goals.filter(goal=>filter==="archive"?!goal.is_active:filter==="achieved"?goal.is_active&&Number(goal.current_amount)>=Number(goal.target_amount):filter==="running"?goal.is_active&&Number(goal.current_amount)<Number(goal.target_amount):goal.is_active);
  const rows = <div className="flex flex-col space-y-space-md">{filtered.map(goal=>{
    const progress = Number(goal.target_amount)>0?Math.min(100,Math.round(Number(goal.current_amount)/Number(goal.target_amount)*100)):0;
    const months = goal.due_date?Math.max(1,differenceInCalendarMonths(new Date(goal.due_date),new Date())):null;
    const days = goal.due_date?differenceInCalendarDays(new Date(goal.due_date),new Date()):null;
    return <ReferencePart key={goal.id} page="target" part="goal-card" values={{"Laptop Kerja Baru":goal.name,"01 Jan 2027":goal.due_date?format(new Date(goal.due_date),"dd MMM yyyy",{locale:language==="en"?enUS:id}):t("Tanpa tenggat"),"Tersisa 3 bln":days===null?"":`${Math.abs(days)} ${t(days>=0?"hari tersisa":"hari lewat")}`,"Tepat Waktu":t(progress>=100?"Tercapai":"Berjalan"),"Rp 7.200.000":money(Number(goal.current_amount),goal.currency),"/ Rp 18.000.000":`/ ${money(Number(goal.target_amount),goal.currency)}`,"40%":`${progress}%`,"Bank BCA • Autodebet Rp 1.500.000/bln":months?`${t("Setoran bulanan")}: ${money(Math.max(0,Number(goal.target_amount)-Number(goal.current_amount))/months,goal.currency)}`:t("Menabung sesuai rencana")}}
      attributes={{"target.79":{onClick:(event:React.MouseEvent)=>{event.stopPropagation();onQuickSave(goal);}},"target.82":{onClick:(event:React.MouseEvent)=>{event.stopPropagation();onDetail(goal);}},"target.73":{className:"w-full h-3 rounded-full overflow-hidden p-0.5",style:{background:"var(--ref-surface-container-highest)"}},"target.74":{style:{width:`${progress}%`}},"target.54":{role:"link",tabIndex:0,onClick:()=>onDetail(goal),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==="Enter")onDetail(goal);}}}} onAction={()=>onDetail(goal)}/>;
  })}{!filtered.length&&<button type="button" onClick={onAdd} className="rounded-[32px] bg-surface-container-lowest p-6 text-primary">{t("Belum ada target")} · {t("Tambah target")}</button>}</div>;
  return <ReferencePart page="target" slots={{"section-3":goals.length?rows:<EmptyState icon="savings" title="Apa yang ingin kamu wujudkan?" description="Buat target tabungan untuk dana darurat, liburan, atau kebutuhan lainnya. Mulai dari nominal yang nyaman untukmu." action="Tambah Target Tabungan" onAction={onAdd}/>,...(!goals.length?{"section-1":null,"section-2":null,"section-4":null}: {})}} values={{"Rp 23.200.000":currencies.length<=1?money(saved):"—","Rp 58.000.000":currencies.length<=1?money(target):t("Dipisahkan per mata uang"),"(40.0% tercapai)":`(${percentage.toFixed(1)}% ${t("tercapai")})`,"3 Target Aktif":`${active.length} ${t("Target Aktif")}`,"Tercepat: Jan 2027":nearest?`${t("Tercepat")}: ${format(new Date(nearest.due_date!),"MMM yyyy",{locale:language==="en"?enUS:id})}`:t("Tanpa tenggat"),"Semua Target (3)":`${t("Semua Target")} (${active.length})`,"Sedang Berjalan (3)":`${t("Sedang Berjalan")} (${active.filter(goal=>Number(goal.current_amount)<Number(goal.target_amount)).length})`,"Tercapai (1)":`${t("Tercapai")} (${active.filter(goal=>Number(goal.current_amount)>=Number(goal.target_amount)).length})`}}
    attributes={{"target.40":{style:{width:`${percentage}%`}}}} onAction={action=>{if(/Target Baru/.test(action))onAdd();else if(/Semua Target/.test(action))setFilter("all");else if(/Sedang Berjalan/.test(action))setFilter("running");else if(/Tercapai/.test(action))setFilter("achieved");else if(/Arsip/.test(action))setFilter("archive");}}/>;
}
