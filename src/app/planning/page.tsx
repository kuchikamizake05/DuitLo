"use client";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import {useSearchParams} from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { BudgetEditor,BudgetView } from "@/components/reference/BudgetView";
import { ReferenceRoot } from "@/components/reference/runtime";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { reportHandledError } from "@/lib/errors";
import { buildEmergencyFundRunwayByCurrency } from "@/lib/finance";
import { buildBudgetProgress,buildFinancialAlerts,buildImportMatchPreview,buildReconciliationReviewSummary,getIdrBudgetScope,parseTransactionCsv,selectUniqueImportRecords,serializeTransactionsCsv,type ImportedTransaction } from "@/lib/financial-control";
import { formatLocalDate,getPlanningDateContext } from "@/lib/planning";
import { getNetworkSnapshot,getServerNetworkSnapshot,offlineWriteMessage,subscribeToNetworkStatus } from "@/lib/pwa";
import { useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore,type FormEvent } from "react";

type Account = { id: string; name: string; currency: string; current_balance: number; updated_at: string; is_active: boolean; kind: "bank" | "ewallet" | "investment" | "trading" | "liability" };
type Transaction = { id: string; date: string; type: "income" | "expense"; merchant: string | null; category: string; amount: number; note: string | null; status: "confirmed" | "pending_approval" | "needs_review" | "deleted"; account_id: string | null };
type Budget = { id: string; category: string; month: string; limit_amount: number };
type SavedCategory = { name: string; type: "income" | "expense" };
type FinancialGoal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; color: string | null; due_date: string | null; is_active: boolean };
type Recurring = { id: string; merchant: string; category: string; amount: number; type: "income" | "expense"; interval: "weekly" | "monthly" | "yearly"; next_run_date: string; is_active: boolean; account_id: string };
type Reconciliation = { id: string; account_id: string; statement_balance: number; ledger_balance: number; reconciled_at: string; note: string | null };
type SavingAction = "budget" | "goal" | "recurring" | "reconcile" | "import" | `run:${string}` | `pause:${string}` | `delete:${string}` | null;

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function PlanningPage() {
  const { t } = useLanguage();
  const params=useSearchParams();
  const openedView=useRef<string|null>(null);
  const [dateContext, setDateContext] = useState(() => getPlanningDateContext(new Date()));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savedCategories, setSavedCategories] = useState<SavedCategory[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "", currentAmount: "0", currency: "IDR", dueDate: "" });
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SavingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({ category: "", month: "", limitAmount: "" });
  const [editingBudget, setEditingBudget] = useState<Budget|null>(null);
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [recurringForm, setRecurringForm] = useState<{ accountId: string; merchant: string; category: string; amount: string; type: "income" | "expense"; interval: "weekly" | "monthly" | "yearly"; nextRunDate: string }>({ accountId: "", merchant: "", category: "", amount: "", type: "expense", interval: "monthly", nextRunDate: "" });
  const [reconcileForm, setReconcileForm] = useState({ accountId: "", statementBalance: "", note: "" });
  const [importAccountId, setImportAccountId] = useState("");
  const [importPreview, setImportPreview] = useState<ImportedTransaction[] | null>(null);
  const [selectedImportRows, setSelectedImportRows] = useState<Set<number>>(() => new Set());
  const importRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = getPlanningDateContext(new Date());
      setDateContext(next);
      setBudgetForm((current) => current.month ? current : { ...current, month: next.month });
      setRecurringForm((current) => current.nextRunDate ? current : { ...current, nextRunDate: next.today });
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
      if (!user) {
        if (requestId === requestIdRef.current) setLoading(false);
        return;
      }
      const [accountsResult, txResult, budgetsResult, savedCategoriesResult, goalsResult, recurringResult, reconciliationsResult] = await Promise.all([
        supabase.from("financial_accounts").select("id,name,currency,current_balance,updated_at,is_active,kind").eq("user_id", user.id).order("is_active", { ascending: false }).order("name"),
        supabase.from("transactions").select("id,date,type,merchant,category,amount,note,status,account_id").eq("user_id", user.id).gte("date", dateContext.month).lt("date", dateContext.nextMonth).order("date", { ascending: false }),
        supabase.from("financial_budgets").select("id,category,month,limit_amount").eq("user_id", user.id).eq("month", dateContext.month),
        supabase.from("categories").select("name,type").or(`user_id.is.null,user_id.eq.${user.id}`).order("name"),
        supabase.from("financial_goals").select("id,name,target_amount,current_amount,currency,color,due_date,is_active").eq("user_id", user.id).eq("is_active", true).order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("recurring_transactions").select("id,merchant,category,amount,type,interval,next_run_date,is_active,account_id").eq("user_id", user.id).order("is_active", { ascending: false }).order("next_run_date"),
        supabase.from("account_reconciliations").select("id,account_id,statement_balance,ledger_balance,reconciled_at,note").eq("user_id", user.id).order("reconciled_at", { ascending: false }).limit(12),
      ]);
      const error = accountsResult.error || txResult.error || budgetsResult.error || savedCategoriesResult.error || goalsResult.error || recurringResult.error || reconciliationsResult.error;
      if (error) throw error;
      if (requestId !== requestIdRef.current) return;
      setAccounts((accountsResult.data ?? []) as Account[]);
      setTransactions((txResult.data ?? []) as Transaction[]);
      setBudgets((budgetsResult.data ?? []) as Budget[]);
      setSavedCategories((savedCategoriesResult.data ?? []) as SavedCategory[]);
      setGoals((goalsResult.data ?? []) as FinancialGoal[]);
      setRecurring((recurringResult.data ?? []) as Recurring[]);
      setReconciliations((reconciliationsResult.data ?? []) as Reconciliation[]);
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

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const accountCurrencies = useMemo(() => new Map(accounts.map((account) => [account.id, account.currency])), [accounts]);
  const idrBudgetScope = useMemo(() => getIdrBudgetScope(transactions, accountCurrencies), [accountCurrencies, transactions]);
  const alerts = useMemo(() => buildFinancialAlerts({ budgets: budgets.map((b) => ({ category: b.category, limitAmount: Number(b.limit_amount), month: b.month.slice(0, 7) })), transactions: idrBudgetScope.idrTransactions, accountFreshness: accounts.map((a) => ({ accountName: a.name, lastUpdatedAt: a.updated_at })), today: dateContext.today }), [accounts, budgets, idrBudgetScope.idrTransactions, dateContext.today]);
  const categories = useMemo(() => [...new Set([
    ...idrBudgetScope.idrTransactions.filter((tx) => tx.type === "expense").map((tx) => tx.category),
    ...budgets.map((budget) => budget.category),
    ...savedCategories.filter((category) => category.type === "expense").map((category) => category.name),
  ])].sort((left, right) => left.localeCompare(right, "id-ID")), [budgets, idrBudgetScope.idrTransactions, savedCategories]);
  const budgetProgresses = useMemo(() => budgets.map((budget) => ({ budget, progress: buildBudgetProgress({ category: budget.category, limitAmount: Number(budget.limit_amount), month: budget.month.slice(0, 7) }, idrBudgetScope.idrTransactions) })), [budgets, idrBudgetScope.idrTransactions]);
  const totalBudget = useMemo(() => budgetProgresses.reduce((sum, item) => sum + Number(item.progress.limitAmount), 0), [budgetProgresses]);
  const totalBudgetSpent = useMemo(() => budgetProgresses.reduce((sum, item) => sum + Number(item.progress.spentAmount), 0), [budgetProgresses]);
  const runwayByCurrency = useMemo(() => buildEmergencyFundRunwayByCurrency(accounts, transactions), [accounts, transactions]);
  const importMatches = useMemo(() => importPreview ? buildImportMatchPreview(
    importPreview,
    transactions.filter((transaction) => transaction.account_id === importAccountId),
  ) : [], [importAccountId, importPreview, transactions]);
  const reconciliationReview = useMemo(() => reconcileForm.accountId
    ? buildReconciliationReviewSummary(transactions.filter((transaction) => transaction.account_id === reconcileForm.accountId))
    : null, [reconcileForm.accountId, transactions]);
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
      setBudgetForm({ category: "", month: dateContext.month, limitAmount: "" }); setBudgetFormOpen(false); setMessage(t("Budget tersimpan.")); await load();
    } catch (error) { reportHandledError("Planning budget save failed", error, "Budget belum tersimpan."); setMessage(t("Budget belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    const targetAmount = Number(goalForm.targetAmount);
    const currentAmount = Number(goalForm.currentAmount);
    if (!goalForm.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0 || !/^[A-Z]{3}$/.test(goalForm.currency)) {
      setMessage(t("Isi target keuangan dengan nominal dan mata uang yang valid."));
      return;
    }
    setSaving("goal"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_goals").insert({
        user_id: user.id,
        name: goalForm.name.trim(),
        target_amount: targetAmount,
        current_amount: currentAmount,
        currency: goalForm.currency,
        due_date: goalForm.dueDate || null,
      });
      if (error) throw error;
      setGoalForm({ name: "", targetAmount: "", currentAmount: "0", currency: "IDR", dueDate: "" });
      setMessage(t("Target keuangan tersimpan.")); await load();
    } catch (error) { reportHandledError("Planning goal save failed", error, "Target keuangan belum tersimpan."); setMessage(t("Target keuangan belum tersimpan. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function archiveGoal(goal: FinancialGoal) {
    if (!guardWrite()) return;
    setSaving(`delete:${goal.id}`); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("financial_goals").update({ is_active: false }).eq("id", goal.id).eq("user_id", user.id);
      if (error) throw error;
      setMessage(t("Target diarsipkan.")); await load();
    } catch (error) { reportHandledError("Planning goal archive failed", error, "Target belum diarsipkan."); setMessage(t("Target belum diarsipkan. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function saveRecurring(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    setSaving("recurring"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const record = { account_id: recurringForm.accountId, merchant: recurringForm.merchant.trim(), category: recurringForm.category.trim(), amount: Number(recurringForm.amount), type: recurringForm.type, interval: recurringForm.interval, next_run_date: recurringForm.nextRunDate };
      const { error } = editingRecurringId
        ? await supabase.from("recurring_transactions").update(record).eq("id", editingRecurringId).eq("user_id", user.id)
        : await supabase.from("recurring_transactions").insert({ user_id: user.id, ...record });
      if (error) throw error;
      const wasEditing = Boolean(editingRecurringId);
      setEditingRecurringId(null); setRecurringForm({ accountId: "", merchant: "", category: "", amount: "", type: "expense", interval: "monthly", nextRunDate: dateContext.today }); setMessage(t(wasEditing ? "Jadwal transaksi diperbarui." : "Jadwal transaksi tersimpan.")); await load();
    } catch (error) { reportHandledError("Planning recurring save failed", error, "Jadwal transaksi belum tersimpan."); setMessage(t("Jadwal transaksi belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  function editRecurring(rule: Recurring) {
    setEditingRecurringId(rule.id);
    setRecurringForm({ accountId: rule.account_id, merchant: rule.merchant, category: rule.category, amount: String(rule.amount), type: rule.type, interval: rule.interval, nextRunDate: rule.next_run_date });
  }

  async function setRecurringActive(rule: Recurring, isActive: boolean) {
    if (!guardWrite()) return;
    setSaving(`pause:${rule.id}`); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("recurring_transactions").update({ is_active: isActive }).eq("id", rule.id).eq("user_id", user.id);
      if (error) throw error;
      setMessage(t(isActive ? "Jadwal diaktifkan kembali." : "Jadwal dijeda. Transaksi lama tetap utuh.")); await load();
    } catch (error) { reportHandledError("Planning recurring state update failed", error, "Status jadwal belum diperbarui."); setMessage(t("Status jadwal belum diperbarui. Coba lagi.")); }
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
      setBudgetToDelete(null); setMessage(t("Budget dihapus. Transaksi tetap utuh.")); await load();
    } catch (error) { reportHandledError("Planning budget delete failed", error, "Budget belum dihapus."); setMessage(t("Budget belum dihapus. Coba lagi.")); }
    finally { setSaving(null); }
  }

  async function reconcile(event: FormEvent) {
    event.preventDefault();
    if (!guardWrite()) return;
    const account = accounts.find((item) => item.id === reconcileForm.accountId); if (!account) return;
    setSaving("reconcile"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("account_reconciliations").insert({ user_id: user.id, account_id: account.id, statement_balance: Number(reconcileForm.statementBalance), ledger_balance: Number(account.current_balance), reconciled_at: dateContext.today, note: reconcileForm.note.trim() || null });
      if (error) throw error;
      setReconcileForm({ accountId: "", statementBalance: "", note: "" }); setMessage(t("Rekonsiliasi tersimpan. Selisihnya tercatat untuk ditindaklanjuti.")); await load();
    } catch (error) { reportHandledError("Planning reconciliation failed", error, "Rekonsiliasi belum tersimpan."); setMessage(t("Rekonsiliasi belum tersimpan. Inputmu tetap aman, coba lagi.")); }
    finally { setSaving(null); }
  }

  async function runRecurring(ruleId: string) {
    if (!guardWrite()) return;
    setSaving(`run:${ruleId}`); setMessage(null);
    try {
      const { error } = await supabase.rpc("run_recurring_transaction", { rule_id: ruleId });
      if (error) throw error;
      setMessage(t("Transaksi berulang sudah masuk ke ledger dan jadwal berikutnya diperbarui.")); await load();
    } catch (error) { reportHandledError("Planning recurring run failed", error, "Jadwal belum dapat dijalankan. Pastikan tanggalnya sudah jatuh tempo."); setMessage(t("Jadwal belum dapat dijalankan. Pastikan tanggalnya sudah jatuh tempo.")); }
    finally { setSaving(null); }
  }

  function downloadCsv() {
    const blob = new Blob([serializeTransactionsCsv(transactions)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `fintrack-${formatLocalDate(new Date())}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function previewImportCsv(file: File) {
    if (!guardWrite()) return;
    if (!importAccountId) { setMessage(t("Pilih akun tujuan sebelum impor CSV.")); return; }
    try {
      const records = parseTransactionCsv(await file.text());
      setImportPreview(records);
      setSelectedImportRows(new Set(records.map((_, index) => index)));
      setMessage(null);
    } catch (error) { reportHandledError("Planning CSV preview failed", error, "CSV tidak dapat dibaca."); setMessage(t("CSV tidak dapat dibaca. Gunakan format ekspor FinTrack.")); }
  }

  async function confirmImportCsv() {
    if (!guardWrite() || !importPreview) return;
    const selectedRecords = importPreview.filter((_, index) => selectedImportRows.has(index));
    const records = selectUniqueImportRecords(
      selectedRecords,
      transactions.filter((transaction) => transaction.account_id === importAccountId),
    );
    if (!records.length) { setMessage(t("Tidak ada transaksi unik untuk diimpor.")); return; }
    setSaving("import"); setMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error } = await supabase.from("transactions").insert(records.map((row) => ({ ...row, user_id: user.id, account_id: importAccountId, source: "manual", status: "needs_review" })));
      if (error) throw error;
      setImportPreview(null); setSelectedImportRows(new Set());
      setMessage(t("{count} transaksi diimpor sebagai Perlu ditinjau.", { count: records.length })); await load();
    } catch (error) { reportHandledError("Planning CSV import failed", error, "CSV tidak dapat diimpor."); setMessage(t("CSV tidak dapat diimpor. Coba lagi.")); }
    finally { setSaving(null); }
  }

  return <ReferenceRoot page="anggaran"><Navbar/>{loading?<main className="pt-20 px-margin" aria-busy="true"><PageSkeleton variant="budget"/></main>:<BudgetView items={budgetProgresses} month={dateContext.month} setMonth={month=>setDateContext(getPlanningDateContext(new Date(`${month}-01T12:00:00`)))} onAdd={()=>{setEditingBudget(null);setBudgetForm({category:"",month:dateContext.month,limitAmount:""});setBudgetFormOpen(true);}} onEdit={budget=>{setEditingBudget(budget);setBudgetForm({category:budget.category,month:budget.month,limitAmount:String(budget.limit_amount)});setBudgetFormOpen(true);}}/>}
    {(loadError||message)&&<p role="status" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-surface-container-lowest p-3 text-on-surface">{loadError??message}</p>}
    {idrBudgetScope.excludedExpenseCount>0&&<p className="mx-margin mb-24 rounded-2xl bg-surface-container-lowest p-4 text-body-sm text-on-surface-variant">{t("Anggaran dihitung dari transaksi rekening IDR.")}</p>}
    {budgetFormOpen&&<BudgetEditor isNew={!editingBudget} spentAmount={buildBudgetProgress({category:budgetForm.category,limitAmount:Number(budgetForm.limitAmount)||0,month:budgetForm.month.slice(0,7)},idrBudgetScope.idrTransactions).spentAmount} form={budgetForm} setForm={setBudgetForm} categories={categories} busy={writeDisabled} error={message} onSave={saveBudget} onClose={()=>setBudgetFormOpen(false)} onDelete={editingBudget?()=>setBudgetToDelete(editingBudget):undefined}/>}
    {budgetToDelete&&<ConfirmDialog titleId="budget-delete-title" descriptionId="budget-delete-description" title={t("Hapus anggaran {category}?",{category:budgetToDelete.category})} description={t("Transaksi yang sudah dicatat tetap tersimpan.")} confirmLabel={t("Hapus")} onClose={()=>setBudgetToDelete(null)} onConfirm={()=>void deleteBudget()} loading={saving===`delete:${budgetToDelete.id}`}/>}
  </ReferenceRoot>;
}
