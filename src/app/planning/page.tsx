"use client";
import { fetchAllRows } from "@/lib/paginated-query";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import {useSearchParams} from "next/navigation";

import { useToast } from "@/components/ui/ToastProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { BudgetEditor,BudgetView } from "@/components/reference/BudgetView";
import { ReferenceRoot } from "@/components/reference/runtime";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { reportHandledError } from "@/lib/errors";
import { buildBudgetProgress,getIdrBudgetScope } from "@/lib/financial-control";
import { getPlanningDateContext } from "@/lib/planning";
import { getNetworkSnapshot,getServerNetworkSnapshot,offlineWriteMessage,subscribeToNetworkStatus } from "@/lib/pwa";
import { useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore,type FormEvent } from "react";

type Account = { id: string; name: string; currency: string; current_balance: number; updated_at: string; is_active: boolean; kind: "bank" | "ewallet" | "investment" | "trading" | "liability" };
type Transaction = { id: string; date: string; type: "income" | "expense"; merchant: string | null; category: string; amount: number; note: string | null; status: "confirmed" | "pending_approval" | "needs_review" | "deleted"; account_id: string | null };
type Budget = { id: string; category: string; month: string; limit_amount: number };
type SavedCategory = { name: string; type: "income" | "expense" };
type SavingAction = "budget" | `delete:${string}` | null;

export default function PlanningPage() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const params=useSearchParams();
  const openedView=useRef<string|null>(null);
  const [dateContext, setDateContext] = useState(() => getPlanningDateContext(new Date()));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savedCategories, setSavedCategories] = useState<SavedCategory[]>([]);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SavingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({ category: "", month: "", limitAmount: "" });
  const [editingBudget, setEditingBudget] = useState<Budget|null>(null);
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const requestIdRef = useRef(0);
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = getPlanningDateContext(new Date());
      setDateContext(next);
      setBudgetForm((current) => current.month ? current : { ...current, month: next.month });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;
      const [accountsResult, txResult, budgetsResult, savedCategoriesResult] = await Promise.all([
        supabase.from("financial_accounts").select("id,name,currency,current_balance,updated_at,is_active,kind").eq("user_id", user.id).order("is_active", { ascending: false }).order("name"),
        fetchAllRows((from, to) => supabase.from("transactions").select("id,date,type,merchant,category,amount,note,status,account_id", { count: "exact" }).eq("user_id", user.id).gte("date", dateContext.month).lt("date", dateContext.nextMonth).order("date", { ascending: false }).order("id", { ascending: false }).range(from, to)),
        supabase.from("financial_budgets").select("id,category,month,limit_amount").eq("user_id", user.id).eq("month", dateContext.month),
        supabase.from("categories").select("name,type").or(`user_id.is.null,user_id.eq.${user.id}`).order("name"),
      ]);
      const error = accountsResult.error || txResult.error || budgetsResult.error || savedCategoriesResult.error;
      if (error) throw error;
      if (requestId !== requestIdRef.current) return;
      setAccounts((accountsResult.data ?? []) as Account[]);
      setTransactions((txResult.data ?? []) as Transaction[]);
      setBudgets((budgetsResult.data ?? []) as Budget[]);
      setSavedCategories((savedCategoriesResult.data ?? []) as SavedCategory[]);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      reportHandledError("Planning data unavailable", error, "Data planning belum berhasil dimuat. Coba lagi saat koneksi tersedia.");
      setLoadError(t("Data planning belum berhasil dimuat. Coba lagi saat koneksi tersedia."));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [dateContext.month, dateContext.nextMonth, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [load]);
  const accountCurrencies = useMemo(() => new Map(accounts.map((account) => [account.id, account.currency])), [accounts]);
  const idrBudgetScope = useMemo(() => getIdrBudgetScope(transactions, accountCurrencies), [accountCurrencies, transactions]);
  const categories = useMemo(() => [...new Set([
    ...idrBudgetScope.idrTransactions.filter((tx) => tx.type === "expense").map((tx) => tx.category),
    ...budgets.map((budget) => budget.category),
    ...savedCategories.filter((category) => category.type === "expense").map((category) => category.name),
  ])].sort((left, right) => left.localeCompare(right, "id-ID")), [budgets, idrBudgetScope.idrTransactions, savedCategories]);
  const budgetProgresses = useMemo(() => budgets.map((budget) => ({ budget, progress: buildBudgetProgress({ category: budget.category, limitAmount: Number(budget.limit_amount), month: budget.month.slice(0, 7) }, idrBudgetScope.idrTransactions) })), [budgets, idrBudgetScope.idrTransactions]);
  const writeDisabled = !online || saving !== null;
  const guardWrite = () => {
    if (online) return true;
    setMessage(offlineWriteMessage);
    return false;
  };

  useEffect(()=>{
    const view=params.get("view"),requested=params.get("id"),key=`${view}:${requested}`;
    if(loading||view!=="edit"||openedView.current===key)return;
    const timer=window.setTimeout(()=>{openedView.current=key;const budget=requested?budgets.find(item=>item.id===requested):budgets[0];if(requested&&!budget)return;setEditingBudget(budget??null);setBudgetForm(budget?{category:budget.category,month:budget.month,limitAmount:String(budget.limit_amount)}:{category:"",month:dateContext.month,limitAmount:""});setBudgetFormOpen(true);},0);
    return()=>window.clearTimeout(timer);
  },[loading,params,budgets,categories,dateContext.month]);

  async function saveBudget(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    setSaving("budget"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const payload = {user_id:user.id,category:budgetForm.category.trim(),month:`${budgetForm.month.slice(0,7)}-01`,limit_amount:Number(budgetForm.limitAmount)};
      if(!payload.category||!Number.isFinite(payload.limit_amount)||payload.limit_amount<=0)throw new Error("Isi kategori dan batas anggaran yang valid.");
      const { error } = editingBudget ? await supabase.from("financial_budgets").update(payload).eq("id",editingBudget.id).eq("user_id",user.id) : await supabase.from("financial_budgets").upsert(payload,{onConflict:"user_id,category,month"});
      if (error) throw error;
      setBudgetForm({ category: "", month: dateContext.month, limitAmount: "" }); setBudgetFormOpen(false); showToast(language==="en"?"Budget saved.":"Budget tersimpan."); await load();
    } catch (error) { reportHandledError("Planning budget save failed", error, "Budget belum tersimpan."); setMessage(t("Budget belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  async function deleteBudget() {
    if (!budgetToDelete || !guardWrite()) return;
    setSaving(`delete:${budgetToDelete.id}`); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_budgets").delete().eq("id", budgetToDelete.id).eq("user_id", user.id);
      if (error) throw error;
      setBudgetToDelete(null); showToast(language==="en"?"Budget deleted. Your transactions are unchanged.":"Budget dihapus. Transaksi tetap utuh."); await load();
    } catch (error) { reportHandledError("Planning budget delete failed", error, "Budget belum dihapus."); setMessage(t("Budget belum dihapus. Coba lagi.")); }
    finally { setSaving(null); }
  }

  return <ReferenceRoot page="anggaran"><Navbar/>{loading?<main className="pt-20 px-margin" aria-busy="true"><PageSkeleton variant="budget"/></main>:<BudgetView items={budgetProgresses} month={dateContext.month} setMonth={month=>setDateContext(getPlanningDateContext(new Date(`${month}-01T12:00:00`)))} onAdd={()=>{setEditingBudget(null);setBudgetForm({category:"",month:dateContext.month,limitAmount:""});setBudgetFormOpen(true);}} onEdit={budget=>{setEditingBudget(budget);setBudgetForm({category:budget.category,month:budget.month,limitAmount:String(budget.limit_amount)});setBudgetFormOpen(true);}}/>}
    {(loadError||message)&&<p role="status" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-surface-container-lowest p-3 text-on-surface">{loadError??message}</p>}
    {idrBudgetScope.excludedExpenseCount>0&&<p className="mx-margin mb-24 rounded-2xl bg-surface-container-lowest p-4 text-body-sm text-on-surface-variant">{t("Anggaran dihitung dari transaksi rekening IDR.")}</p>}
    {budgetFormOpen&&<BudgetEditor isNew={!editingBudget} spentAmount={buildBudgetProgress({category:budgetForm.category,limitAmount:Number(budgetForm.limitAmount)||0,month:budgetForm.month.slice(0,7)},idrBudgetScope.idrTransactions).spentAmount} form={budgetForm} setForm={setBudgetForm} categories={categories} busy={writeDisabled} error={message} onSave={saveBudget} onClose={()=>setBudgetFormOpen(false)} onDelete={editingBudget?()=>setBudgetToDelete(editingBudget):undefined}/>}
    {budgetToDelete&&<ConfirmDialog titleId="budget-delete-title" descriptionId="budget-delete-description" title={t("Hapus anggaran {category}?",{category:budgetToDelete.category})} description={t("Transaksi yang sudah dicatat tetap tersimpan.")} confirmLabel={t("Hapus")} onClose={()=>setBudgetToDelete(null)} onConfirm={()=>void deleteBudget()} loading={saving===`delete:${budgetToDelete.id}`}/>}
  </ReferenceRoot>;
}
