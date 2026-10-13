"use client";
import {categoryAttributes,categoryColor} from "./category-palette";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id,enUS } from "date-fns/locale";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { DialogFrame } from "@/components/ui/DialogFrame";
import type { InsightSnapshot } from "@/lib/insights";
import { serializeCsv } from "@/lib/reporting";
import { ReferencePart, Symbol } from "./runtime";
import { categorySymbol } from "./DashboardView";

type Category = { name: string; amount: number; share: number };
export function ReportsView({ snapshot, month, setMonth, budget, incomeCategories, observations, generated }: {
  snapshot: InsightSnapshot; month: string; setMonth: (month: string) => void; budget: number | null;
  incomeCategories: Category[]; observations: string[]; generated: boolean;
}) {
  const { theme } = useTheme();
  const { t ,language}=useLanguage();
  const router = useRouter();
  const [type,setType] = useState("expense");
  const [chart,setChart] = useState("donut");
  const [periodOpen,setPeriodOpen] = useState(false);
  const [exportOpen,setExportOpen] = useState(false);
  const selected = new Date(`${month}-01T12:00:00`);
  const total = type==="expense"?snapshot.current.expense:snapshot.current.income;
  const categories = (type==="expense"?snapshot.topCategories:incomeCategories).slice(0,6);
  const remainingShare=Math.max(0,100-categories.slice(0,3).reduce((sum,item)=>sum+item.share,0));
  const donutCategories=[...categories.slice(0,3),...(remainingShare>0&&total>0?[{name:t("Lainnya"),amount:total*remainingShare/100,share:remainingShare}]:[])];
  const money = (amount:number,currency="IDR")=>new Intl.NumberFormat(language==="en"?"en-ID":"id-ID",{style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2}).format(amount);
  const savingsScore = snapshot.savingsRate===null?45:Math.max(0,Math.min(100,snapshot.savingsRate));
  const score = snapshot.current.confirmedCount===0?null:Math.round(Math.min(100,25+savingsScore*.5+(snapshot.current.netCashFlow>=0?25:0)+Math.min(25,snapshot.current.confirmedCount*3)));
  const usage = budget&&budget>0?Math.min(100,snapshot.current.expense/budget*100):0;
  const remaining = budget===null?null:budget-snapshot.current.expense;
  const bars = <div className="my-5" id="report-bar-chart" role="img" aria-label={t("Distribusi pengeluaran terbesar")} hidden={chart!=="bar"}><div className="flex justify-between gap-2 font-body-sm text-[11px] text-on-surface-variant mb-5"><span>{t("Distribusi Pengeluaran Terbesar")}</span><span className="shrink-0">{Math.min(5,categories.length)} {t("Kategori")}</span></div><div className="grid grid-cols-5 gap-3 items-end">{categories.slice(0,5).map(category=><div key={category.name} className="min-w-0 flex flex-col items-center"><div className="h-[174px] w-full flex flex-col items-center justify-end"><span className="font-label-sm text-[11px] text-on-surface-variant mb-2">{category.share.toLocaleString(language==="en"?"en-ID":"id-ID",{maximumFractionDigits:1})}%</span><div role="img" aria-label={`${category.name}: ${category.share.toFixed(1)}%`} className="w-full max-w-[32px] rounded-t-[9px]" style={{height:Math.max(2,category.share/Math.max(...categories.map(item=>item.share),1)*150),background:categoryColor(category.name,theme)}}/></div><span title={category.name} {...categoryAttributes(category.name,"mt-3 w-8 h-8 rounded-full flex items-center justify-center")}><Symbol className="text-[17px]">{categorySymbol(category.name)}</Symbol></span><span className="sr-only">{category.name}</span></div>)}</div></div>;
  const circumference=2*Math.PI*70;
  const donut = <div className="flex flex-col items-center justify-center my-4 relative" hidden={chart!=="donut"} id="report-donut-chart"><div className="relative w-52 h-52 flex items-center justify-center"><svg aria-label={t("Grafik Distribusi Kategori Finansial")} className="w-full h-full -rotate-90" viewBox="0 0 180 180"><circle cx="90" cy="90" fill="none" r="70" stroke={total>0?"none":"var(--ref-surface-container-low)"} strokeWidth="22"/>{donutCategories.map((category,index)=>{const start=donutCategories.slice(0,index).reduce((sum,item)=>sum+item.share/100*circumference,0);const length=category.share/100*circumference;
      if(donutCategories.length===1)return <circle key={category.name} cx="90" cy="90" fill="none" r="70" stroke={categoryColor(category.name,theme)} strokeWidth="22"/>;
      const gap=Math.min(6,length*.15),corner=Math.min(3,length*.1);
      const from=(start+gap/2+corner)/70,to=(start+length-gap/2-corner)/70;
      const point=(radius:number,angle:number)=>`${90+radius*Math.cos(angle)} ${90+radius*Math.sin(angle)}`;
      const outer=81-corner,inner=59+corner,large=to-from>Math.PI?1:0;
      const path=`M ${point(outer,from)} A ${outer} ${outer} 0 ${large} 1 ${point(outer,to)} L ${point(inner,to)} A ${inner} ${inner} 0 ${large} 0 ${point(inner,from)} Z`;
      return <path key={category.name} d={path} fill={categoryColor(category.name,theme)} stroke={categoryColor(category.name,theme)} strokeWidth={corner*2} strokeLinejoin="round"/>;})}</svg><div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"><span className="font-label-sm text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">{t("Terbesar")}</span><span className="font-headline-lg text-headline-lg font-bold text-primary leading-tight">{categories[0]?.share??0}%</span><span className="font-body-sm text-[11px] text-on-surface font-semibold max-w-[80px] truncate">{categories[0]?.name??"—"}</span></div></div><div className="flex flex-wrap justify-center gap-2 mt-4 px-2">{donutCategories.map(category=><span key={category.name} className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-1 bg-surface-container-low"><span className="size-2 rounded-full" style={{background:categoryColor(category.name,theme)}}/>{category.name} ({category.share.toFixed(1)}%)</span>)}</div></div>;
  const categoryRows = <div className="space-y-3 pt-4 mt-2">{categories.map(category=>{
    const previous=(type==="expense"?snapshot.previousCategoryAmounts:snapshot.previousIncomeCategoryAmounts)?.[category.name]??0;
    const change=previous>0?(category.amount-previous)/previous*100:null;
    const badgeTone=change===null?null:change<0?"green":change<=5?"yellow":"red";
    const badgeColors=badgeTone===null?{background:"var(--ref-surface-container)",color:"var(--ref-on-surface-variant)"}:theme==="dark"?{
      green:{background:"#203b2d",color:"#8aceaa"},
      yellow:{background:"#40351d",color:"#f0cc75"},
      red:{background:"#48262c",color:"#ffadb4"},
    }[badgeTone]:{
      green:{background:"#c5ecd2",color:"#00652c"},
      yellow:{background:"#fff0c2",color:"#765500"},
      red:{background:"#ffdadf",color:"#a12638"},
    }[badgeTone];
    const comparison=change===null?t("Belum ada data bulan lalu"):`${change>0?"+":""}${change.toLocaleString(language==="en"?"en-ID":"id-ID",{maximumFractionDigits:1})}% ${t("vs bulan lalu")}`;
    return <ReferencePart key={category.name} page="laporan" part="category-row" values={{"icon:receipt_long":categorySymbol(category.name),"Tagihan & Utilitas":category.name,"Naik 2% vs Sep":<><span style={{color:theme==="light"?"#00652c":"#aac7ff"}}>{category.share.toLocaleString(language==="en"?"en-ID":"id-ID",{maximumFractionDigits:1})}%</span>{" "}<span className="text-on-surface-variant">{t("dari total")}</span></>,"Rp 2.425.000":money(category.amount),"65.9%":comparison}} attributes={{
      "laporan.128":{className:"flex flex-col gap-2 p-3 rounded-[20px] bg-surface-container-low"},
      "laporan.129":{className:"flex items-center justify-between gap-3"},
      "laporan.131":categoryAttributes(category.name,"w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"),
      "laporan.136":{className:"text-right flex-shrink-0 max-w-[48%]"},
      "laporan.138":{className:"inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium",style:badgeColors},
      "laporan.139":{className:"w-full bg-surface-container rounded-full h-1.5 overflow-hidden"},
      "laporan.140":{className:"h-full rounded-full",style:{width:`${category.share.toFixed(1)}%`,background:categoryColor(category.name,theme)}}
    }}/>;
  })}{!categories.length&&<p className="text-body-md text-on-surface-variant">{t("Belum ada data terverifikasi")}</p>}</div>;
  const pattern = <div className="space-y-2.5 mb-4">{(observations.length?observations:[t("Belum ada pola untuk periode ini.")]).slice(0,2).map((observation,index)=><div key={observation} className="flex items-start gap-2.5"><Symbol className={`${index?"text-amber-600":"text-primary"} text-[18px] mt-0.5 flex-shrink-0`}>{index?"warning":"check_circle"}</Symbol><p className="font-body-md text-body-md text-on-surface leading-snug">{t(observation)}</p></div>)}</div>;
  const separated = snapshot.fxState==="separate"&&snapshot.currencyGroups.length>0;
  const slots = {"report-bars":bars,"report-donut":donut,"category-rows":categoryRows,"pattern-observations":pattern,...(separated?{"section-2":<div className="rounded-[24px] bg-surface-container-lowest p-space-lg mb-space-lg"><p className="text-body-sm text-on-surface-variant">{t("Arus kas dipisahkan per mata uang")}</p>{snapshot.currencyGroups.map(group=><div key={group.currency} className="mt-3"><strong>{group.currency}</strong><p>{t("Pemasukan")}: {money(group.current.income,group.currency)}</p><p>{t("Pengeluaran")}: {money(group.current.expense,group.currency)}</p></div>)}<p className="mt-3 text-body-sm text-error">{t("Kurs IDR belum tersedia. Nilai tidak digabung.")}</p></div>,"section-3":null,"section-4":null}:{})};
  function download() {
    const csv=serializeCsv(separated ? [["FinTrack",snapshot.periodLabel],["Mata uang","Pemasukan","Pengeluaran","Arus kas"],...snapshot.currencyGroups.map(group=>[group.currency,group.current.income,group.current.expense,group.current.netCashFlow])] : [["FinTrack",snapshot.periodLabel],["Pemasukan",snapshot.current.income],["Pengeluaran",snapshot.current.expense],["Arus kas",snapshot.current.netCashFlow],[],["Kategori","Nominal IDR","Porsi %"],...snapshot.topCategories.map(category=>[category.name,category.amount,category.share])]);
    const url=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`fintrack-laporan-${month}.csv`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setExportOpen(false);
  }
  return <><ReferencePart page="laporan" slots={slots} values={{"Okt 2026":format(selected,"MMM yyyy",{locale:language==="en"?enUS:id}),"Oktober":format(selected,"MMMM",{locale:language==="en"?enUS:id}),"Ringkasan Oktober":`${t("Ringkasan")} ${format(selected,"MMMM",{locale:language==="en"?enUS:id})}`,"Total Pengeluaran":t(type==="expense"?"Total Pengeluaran":"Total Pemasukan"),"Rp 3.678.000":money(total),"Batas Anggaran: Rp 7.550.000":`${t("Batas Anggaran")}: ${budget===null?"—":money(budget)}`,"Sisa Rp 3.872.000":`${t("Sisa")} ${remaining===null?"—":money(remaining)}`,"100":score===null?"—":String(score),"AI":generated?"AI":"FinTrack"}}
    attributes={{"laporan.60":{"aria-pressed":chart==="donut",className:`px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all ${chart==="donut"?"bg-surface-container-lowest text-primary shadow-sm font-bold":"text-on-surface-variant font-medium"}`},"laporan.62":{"aria-pressed":chart==="bar",className:`px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all ${chart==="bar"?"bg-surface-container-lowest text-primary shadow-sm font-bold":"text-on-surface-variant font-medium"}`},"laporan.23":{"aria-pressed":type==="expense",className:`rounded-full py-2.5 font-label-md text-label-md font-semibold ${type==="expense"?"bg-primary text-on-primary shadow-sm":"text-on-surface-variant"}`},"laporan.24":{"aria-pressed":type==="income",className:`rounded-full py-2.5 font-label-md text-label-md font-semibold ${type==="income"?"bg-primary text-on-primary shadow-sm":"text-on-surface-variant"}`},"laporan.42":{style:{width:`${usage}%`}}}}
    onAction={action=>{if(action==="tab-income")setType("income");else if(action==="tab-expense")setType("expense");else if(action==="view-bar")setChart("bar");else if(action==="view-donut")setChart("donut");else if(/Okt 2026/.test(action))setPeriodOpen(true);else if(/Unduh/.test(action))setExportOpen(true);else if(/Atur Batas/.test(action))router.push("/planning");else if(/Rincian/.test(action))router.push("/transactions");}}/>
    {periodOpen&&<DialogFrame titleId="report-period-title" onClose={()=>setPeriodOpen(false)}><div className="p-5"><h2 id="report-period-title">{t("Pilih periode")}</h2><input aria-label={t("Periode")} type="month" value={month} onChange={event=>{if(event.target.value){setMonth(event.target.value);setPeriodOpen(false);}}} className="mt-4 w-full rounded-2xl border p-3"/></div></DialogFrame>}
    {exportOpen&&<DialogFrame titleId="report-export-title" onClose={()=>setExportOpen(false)}><div className="p-5"><h2 id="report-export-title" className="font-bold">{t("Unduh Laporan Keuangan")}</h2><div className="mt-4 grid gap-3"><button onClick={download} className="rounded-full bg-primary-container py-3 text-white">{t("Excel / CSV")}</button><button onClick={()=>{setExportOpen(false);window.setTimeout(()=>window.print(),0);}} className="rounded-full bg-secondary-container py-3 text-primary">PDF</button></div></div></DialogFrame>}
    <section data-print-report><h1>FinTrack — {snapshot.periodLabel}</h1>{snapshot.fxState==="converted"?<><p>{t("Pemasukan")}: {money(snapshot.current.income)}</p><p>{t("Pengeluaran")}: {money(snapshot.current.expense)}</p><table><thead><tr><th>{t("Kategori")}</th><th>IDR</th><th>%</th></tr></thead><tbody>{snapshot.topCategories.map(category=><tr key={category.name}><td>{category.name}</td><td>{money(category.amount)}</td><td>{category.share}</td></tr>)}</tbody></table></>:snapshot.currencyGroups.map(group=><p key={group.currency}>{group.currency}: {money(group.current.netCashFlow,group.currency)}</p>)}</section>
  </>;
}
