"use client";

import {TransactionDetail} from "./TransactionDetail";
import {InstitutionLogo} from "@/components/InstitutionLogo";
import {categoryAttributes} from "./category-palette";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, FlagTriangleRight, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id, enUS } from "date-fns/locale";
import { useLanguage } from "@/components/LanguageProvider";
import {useTheme} from "@/components/ThemeProvider";
import { ReferencePart, Symbol } from "./runtime";
import { DialogFrame } from "@/components/ui/DialogFrame";
import type { useFinancialJourney } from "@/components/FinancialJourney";

type Account = { id: string; name: string; institution: string | null; kind: string; currency: string; current_balance: number; reporting_balance_idr: number | null; is_active: boolean };
type Transaction = { id: string; date: string; merchant: string | null; category: string; amount: number; type: "income" | "expense"; account_id: string | null; status: string; created_at: string };
type Goal = { name: string; current_amount: number; target_amount: number; currency: string };
type Budget = { id: string; category: string; spent: number; limit_amount: number };

export function categorySymbol(name: string) {
  return /makan|food|kafe|coffee/i.test(name) ? "restaurant" : /tagih|listrik|bill/i.test(name) ? "receipt_long" : /transport|bensin|fuel/i.test(name) ? "directions_car" : /belanja|shopping/i.test(name) ? "shopping_bag" : /hiburan|entertain/i.test(name) ? "movie" : /gaji|salary/i.test(name) ? "payments" : /bonus|gift|thr/i.test(name)?"redeem":/sehat|health|vitamin|obat/i.test(name)?"health_and_safety":/pendidikan|education|sekolah|kursus/i.test(name)?"school":/rumah|hunian|home/i.test(name)?"home":"category";
}

export function DashboardView({ firstName, month, setMonth, accounts, transactions, budgets, goal, income, expense, currency, visible, toggleVisible, journey }: {
  firstName: string; month: Date; setMonth: (date: Date) => void; accounts: Account[]; transactions: Transaction[];
  budgets: Budget[]; goal?: Goal; income: number; expense: number; currency: string | null; visible: boolean;
  toggleVisible: () => void; journey: ReturnType<typeof useFinancialJourney>;
}) {
  const [detailTransaction,setDetailTransaction]=useState<Transaction|null>(null);
  const { language, t }=useLanguage();
  const {theme}=useTheme();
  const router = useRouter();
  const [monthOpen, setMonthOpen] = useState(false);
  const money = (amount: number, code = "IDR") => visible ? new Intl.NumberFormat(language === "en" ? "en-ID" : "id-ID", { style: "currency", currency: code, maximumFractionDigits: code === "IDR" ? 0 : 2 }).format(amount) : "••••••••••";
  const assets = accounts.filter(account => account.is_active && account.kind !== "liability");
  const completeBalance = assets.every(account => account.currency === "IDR" || account.reporting_balance_idr != null);
  const balance = assets.reduce((sum, account) => sum + Number(account.currency === "IDR" ? account.current_balance : account.reporting_balance_idr ?? 0), 0);
  const net = income - expense;
  const goalPercentage = goal && Number(goal.target_amount) > 0 ? Math.min(100, Math.round(Number(goal.current_amount) / Number(goal.target_amount) * 100)) : 0;
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6);
  const weekNet = transactions.filter(tx => new Date(tx.date) >= weekStart && tx.account_id && accounts.find(account => account.id === tx.account_id)?.currency === "IDR").reduce((sum, tx) => sum + Number(tx.amount) * (tx.type === "income" ? 1 : -1), 0);
  const values = {
    "Halo, Faaid 👋": `${t("Halo")}, ${firstName} 👋`, "Okt 2026": format(month, "MMM yyyy", { locale: language === "en" ? enUS : id }),
    "Rp 24.850.000": completeBalance ? money(balance) : "—", "Rp 13.650.000": currency ? money(income, currency) : transactions.length ? "—" : money(0),
    "Rp 2.663.000": currency ? money(expense, currency) : transactions.length ? "—" : money(0),
    "+Rp 10.987.000": currency ? `${net >= 0 ? "+" : "−"}${money(Math.abs(net), currency)}` : transactions.length ? "—" : money(0),
    "+Rp 50.000 minggu ini": `${weekNet >= 0 ? "+" : "−"}${money(Math.abs(weekNet))} ${t("minggu ini")}`,
    "Rekor: 12 hari": `${t("Rekor")}: ${journey.data?.streak.longest ?? 0} ${t("hari")}`,
    "Laptop Kerja Baru": goal?.name ?? t("Mulai Target Tabungan"),
    "Terkumpul Rp 7.200.000 dari Rp 18.000.000 (40%)": goal ? `${t("Terkumpul")} ${money(Number(goal.current_amount), goal.currency)} ${t("dari")} ${money(Number(goal.target_amount), goal.currency)} (${goalPercentage}%)` : t("Tentukan tujuan dan target yang ingin kamu capai."),
    "40%": `${goalPercentage}%`,
  };
  const budgetRows = <div data-guide="budget" className="p-space-md rounded-[24px] bg-surface-container-lowest shadow-[0_4px_20px_-2px_rgba(18,53,36,0.04)] flex flex-col gap-3">
    {budgets.length ? budgets.slice(0, 3).map(budget => {
      const percentage = Number(budget.limit_amount) > 0 ? Math.round(budget.spent / Number(budget.limit_amount) * 100) : 0;
      return <ReferencePart key={budget.id} page="beranda" part="budget-row" values={{"Tagihan Rutin & Utilitas": budget.category, "97%": `${percentage}%`, "(Rp 2.425.000)": `(${money(budget.spent)})`}}
        attributes={{"beranda.108":{className:"w-full h-3 rounded-full overflow-hidden p-0.5",style:{background:"var(--ref-surface-container-highest)"}},"beranda.109": {className:"h-full rounded-full",style: {background:percentage>=100?"var(--ref-error)":percentage>=80?"#d4a544":"#0b57d0",width: `${Math.min(100,percentage)}%`}}}}/>;
    }) : <div className="flex items-start gap-3 py-1">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Symbol className="text-[24px]">pie_chart</Symbol></span>
      <div className="min-w-0 flex-1">
        <p className="font-headline-sm text-body-lg font-bold text-on-surface">{language==="en"?"Give your spending a plan":"Beri rencana untuk pengeluaranmu"}</p>
        <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{language==="en"?"Set a monthly limit and track how much you have left.":"Tentukan batas bulanan dan pantau sisa anggaranmu."}</p>
        <Link href="/planning" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary/10 px-4 text-xs font-bold text-primary">{t("Atur budget")}<Symbol className="text-[16px]">arrow_forward</Symbol></Link>
      </div>
    </div>}
  </div>;
  const recent = <div className="flex flex-col gap-space-md"><div className="flex items-center justify-between"><h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Transaksi Terbaru")}</h2><Link href="/transactions" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-primary text-label-sm">{t("Semua")}<Symbol className="text-[16px]">tune</Symbol></Link></div>
    {transactions.length ? Object.entries(transactions.slice(0,5).reduce<Record<string,Transaction[]>>((groups,tx)=>{const date=tx.date.slice(0,10);(groups[date]??=[]).push(tx);return groups;},{})).map(([date,items])=>{
      const today=format(now,"yyyy-MM-dd"),yesterday=format(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1),"yyyy-MM-dd");const codes=new Set(items.map(tx=>accounts.find(account=>account.id===tx.account_id)?.currency??"IDR"));const groupNet=items.reduce((sum,tx)=>sum+Number(tx.amount)*(tx.type==="income"?1:-1),0);
      return <div key={date} className="flex flex-col gap-space-sm"><div className="flex justify-between items-center px-1"><span className="font-label-md text-label-md text-on-surface-variant">{date===today?t("Hari ini"):date===yesterday?t("Kemarin"):format(new Date(date),"d MMM yyyy",{locale:language==="en"?enUS:id})}</span><span className="font-label-sm text-label-sm text-on-surface-variant">{t("Total")} {codes.size===1?`${groupNet>=0?"+":"−"}${money(Math.abs(groupNet),[...codes][0])}`:"—"}</span></div>{items.map(tx=>{
        const account=accounts.find(account=>account.id===tx.account_id);
        return <Link key={tx.id} href={`/transactions?view=detail&id=${tx.id}`} onClick={event=>{event.preventDefault();setDetailTransaction(tx);}} className="w-full flex items-center gap-3 rounded-[24px] bg-surface-container-lowest p-4 text-left shadow-sm transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98]"><span {...categoryAttributes(tx.category,"w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center")}><span aria-hidden="true" className="material-symbols-outlined text-[24px]">{categorySymbol(tx.category)}</span></span><span className="min-w-0 flex-1 flex flex-col gap-1.5"><span className="truncate text-[14px] leading-5 font-medium text-on-surface">{tx.merchant??tx.category}</span><span className="flex items-center gap-1.5 text-[12px] leading-4 text-on-surface-variant flex-wrap"><InstitutionLogo name={account?.institution||account?.name||""} className="w-5 h-5 shrink-0"/><span className="truncate max-w-full">{account?.name??t("Tanpa rekening")}</span><span aria-hidden="true">·</span><span className="shrink-0" style={{color:"var(--ref-on-surface-variant)"}}>{format(new Date(tx.created_at),"HH:mm")}</span></span></span><span className="shrink-0 flex flex-col items-end gap-1.5"><span data-cash-flow={tx.type} className="text-[14px] leading-5 font-medium whitespace-nowrap" style={{color:tx.type==="income"?"#1abd7e":"var(--ref-error)"}}>{account?.currency?`${tx.type==="income"?"+":"−"} ${money(Number(tx.amount),account.currency)}`:"—"}</span><span data-activity-status={tx.status} className="inline-flex rounded-full px-2 py-0.5 text-[10px] leading-4 font-semibold" style={{background:tx.status==="confirmed"?"#1abd7e18":tx.status==="deleted"?"var(--ref-surface-container-highest)":"#f2cb7220",color:tx.status==="confirmed"?"#087c4e":tx.status==="deleted"?"var(--ref-on-surface-variant)":"#855900"}}>{t(tx.status==="confirmed"?"Berhasil":tx.status==="deleted"?"Sampah":"Perlu ditinjau")}</span></span></Link>;
      })}</div>;
    }) : <p className="text-body-sm text-on-surface-variant">{t("Belum ada transaksi")}</p>}
  </div>;
  const streakDays = <div className="mt-2 grid grid-cols-7 gap-2 pt-1">{(journey.data?.streak.days ?? Array.from({length:7},(_,index)=>({date:format(new Date(now.getFullYear(),now.getMonth(),now.getDate()-6+index),"yyyy-MM-dd"),completed:false}))).map(day=>{
    const today = day.date === format(now,"yyyy-MM-dd");
    const label = String(Number(day.date.slice(-2)));
    return <button key={day.date} type="button" aria-label={`${format(new Date(`${day.date}T12:00:00`),"EEE d MMM",{locale:language==="en"?enUS:id})}, ${day.completed?t("Berhasil"):t("Belum ada transaksi")}`} aria-current={today?"date":undefined} disabled={!today||day.completed||journey.dailySaving||journey.loading||Boolean(journey.error)} onClick={()=>void journey.completeDailyReview()} className="flex min-h-11 flex-col items-center justify-center disabled:cursor-default"><span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{background:day.completed||today?"#ff9800":theme==="dark"?"#292b30":"#f4f5f6",color:day.completed||today?"#fff":theme==="dark"?"#a5a9b1":"#9ca1a7",border:day.completed||today?"1px solid transparent":theme==="dark"?"1px solid #41444b":"1px solid #e2e4e7",boxShadow:today?`0 0 0 6px ${theme==="dark"?"#ff980026":"#fff0d2"}`:"none"}}>{day.completed?<Check size={22} style={{strokeWidth:3}} aria-hidden="true"/>:label}</span></button>;
  })}</div>;
  const streakCard = <section aria-label={t("Jaga Konsistensi")} className="relative rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(18,53,36,0.04)] border border-outline-variant/10">
    <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 flex-1 items-center gap-2.5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff0dc] dark:bg-[#ff98001a]"><StreakFlame/></span><div className="min-w-0 flex-1"><h3 className="font-headline-sm text-body-lg font-bold leading-6 text-on-surface">{t("Jaga Konsistensi")}</h3><p className="text-[12px] leading-[18px] text-on-surface-variant">{t("Catat transaksi tiap hari")}</p></div></div>
    <div className="flex w-[78px] shrink-0 flex-col items-stretch gap-1.5 text-center"><span className="rounded-md border border-[#ffd8a8] bg-[#fff0dc] px-1.5 py-0.5 text-[11px] leading-4 font-medium text-[#a74b00] dark:border-[#80551f] dark:bg-[#ff98001a] dark:text-[#ffc36c]">{journey.data?.streak.current??0} {t("hari")}</span><span className="inline-flex items-center justify-center gap-1 rounded-full border border-[#d3e9dc] bg-[#f4fbf6] px-2 py-1 text-[10px] leading-4 font-medium text-[#167040] dark:border-[#365542] dark:bg-[#20372a] dark:text-[#9bd7b0]"><Star size={12} style={{strokeWidth:1.75}} aria-hidden="true"/>{language==="en"?"Best":"Rekor"}: {journey.data?.streak.longest??0}{language==="en"?"d":"h"}</span></div></div>
    {streakDays}
  </section>;

  return <>{detailTransaction&&<TransactionDetail transaction={{...detailTransaction,note:(detailTransaction as Transaction&{note?:string|null}).note??null,receipt_url:(detailTransaction as Transaction&{receipt_url?:string|null}).receipt_url??null}} accountName={accounts.find(account=>account.id===detailTransaction.account_id)?.name??"—"} accountInstitution={accounts.find(account=>account.id===detailTransaction.account_id)?.institution??undefined} currency={accounts.find(account=>account.id===detailTransaction.account_id)?.currency??"IDR"} onClose={()=>setDetailTransaction(null)} onEdit={()=>router.push(`/transactions?view=detail&id=${detailTransaction.id}`)} onDelete={()=>router.push(`/transactions?view=detail&id=${detailTransaction.id}`)}/>}<ReferencePart page="beranda" values={values} slots={{"section-0":<div className="flex items-start justify-between gap-3 pt-1"><div className="min-w-0"><h1 className="text-headline-lg font-bold tracking-tight text-on-surface">{t("Halo")}, {firstName} 👋</h1><p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">{t("Yuk, lihat kabar keuanganmu hari ini.")}</p></div><button type="button" onClick={()=>setMonthOpen(true)} className="ft-month-picker mt-1 shrink-0 flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1.5 text-label-md font-bold text-on-surface"><CalendarDays size={16} className="text-primary" style={{strokeWidth:1.75}} aria-hidden="true"/>{format(month,"MMM yyyy",{locale:language==="en"?enUS:id})}<ChevronDown size={16} className="text-on-surface-variant" style={{strokeWidth:1.75}} aria-hidden="true"/></button></div>,"budget-rows":budgetRows,"section-6":recent,"section-3":streakCard,"streak-days":streakDays,"goal-icon":<FlagTriangleRight size={24} strokeWidth={1.5} style={{strokeWidth:1.5}} aria-hidden="true"/>}} attributes={{"beranda.126":{style:{width:44,height:44,flexShrink:0,background:theme==="dark"?"#254c39":"#ddf0e4",color:theme==="dark"?"#a3d9b9":"#00652c",boxShadow:"none"}},"beranda.135": {style:{strokeDasharray:`${goalPercentage},100`}},"beranda.124":{"data-guide":"goal",role:"link",tabIndex:0,onClick:()=>router.push("/goals"),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==="Enter")router.push("/goals");}},"beranda.31":{style:{display:"block"}},"beranda.32":{style:{display:"none"}}}}
    onAction={action=>{if(action==="toggle-balance-visibility")toggleVisible();else if(action==="month-selector-btn")setMonthOpen(true);else if(/fintrack-laporan|Analisis/.test(action))router.push("/insights");else if(/Semua/.test(action))router.push("/transactions");}}/>
    {monthOpen&&<DialogFrame titleId="reference-period-title" onClose={()=>setMonthOpen(false)}><div className="p-5"><h2 id="reference-period-title" className="font-bold">{t("Pilih periode")}</h2><input aria-label={t("Periode")} type="month" value={format(month,"yyyy-MM")} onChange={event=>{if(event.target.value){setMonth(new Date(`${event.target.value}-01T12:00:00`));setMonthOpen(false);}}} className="mt-4 w-full rounded-2xl border border-outline-variant p-3"/></div></DialogFrame>}
  </>;
}

function StreakFlame() {
  return <svg width="25" height="30" viewBox="0 0 28 34" fill="none" aria-hidden="true"><path d="M13 1C15 9 7 10 9 17C6 16 5 13 5 11C1 17 0 20 1 24C2 30 7 34 14 34C22 34 27 29 27 22C27 16 23 10 21 8C22 14 19 15 18 16C19 10 17 5 13 1Z" fill="#ff8908"/><path d="M15 15C16 21 10 22 10 27C10 30 12 33 15 34C20 33 23 30 23 26C23 22 20 19 19 18C19 22 17 23 17 23C18 20 17 17 15 15Z" fill="#ffc83d"/></svg>;
}
