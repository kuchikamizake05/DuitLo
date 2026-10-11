"use client";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import {useSearchParams} from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { InvestmentDetail } from "@/components/reference/InvestmentDetail";
import { InvestmentEditor,SnapshotEditor,type ExecutionForm } from "@/components/reference/InvestmentEditors";
import { InvestmentDelete,InvestmentResult } from "@/components/reference/InvestmentFeedback";
import { PortfolioView } from "@/components/reference/PortfolioView";
import { ReferenceRoot } from "@/components/reference/runtime";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { useToast } from "@/components/ui/ToastProvider";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { buildPortfolioWeeklyEquitySeries } from "@/lib/analytics";
import { reportHandledError } from "@/lib/errors";
import { encodeInvestmentNote,decodeInvestmentNote,buildInvestmentPositions,filterStockExecutions,validateExecutionForm,validateSnapshotForm,type InvestmentExecution } from "@/lib/investments";
import { formatLocalDateTime } from "@/lib/planning";
import { canWriteOnline,offlineWriteMessage } from "@/lib/pwa";
import { enUS,id as idLocale } from "date-fns/locale";
import { X } from "lucide-react";
import { useCallback,useEffect,useMemo,useRef,useState,type FormEvent } from "react";

type Account = { id: string; name: string; currency: string; is_active: boolean };
type Execution = InvestmentExecution & { currency: string; note: string | null };
type Snapshot = { id: string; account_id: string; recorded_at: string; equity: number; currency: string; note: string | null };
type SideFilter = "all" | "buy" | "sell";

function nowLocal() { return formatLocalDateTime(new Date()); }
function createExecutionForm(accountId = ""):ExecutionForm { return { accountId, assetCategory:"stock",assetName:"",ticker: "", side: "buy" as "buy" | "sell", quantity: "", price: "", fee: "0", executedAt: nowLocal(), note: "" }; }
function createSnapshotForm(accountId = "") { return { accountId, equity: "", recordedAt: nowLocal(), note: "" }; }

export default function InvestmentsPage() {
  const { language, t } = useLanguage();
  const params=useSearchParams();
  const openedView=useRef<string|null>(null);
  const { showToast } = useToast();
  const dateLocale = language === "en" ? enUS : idLocale;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const executionSaving=useRef(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailPosition, setDetailPosition] = useState<ReturnType<typeof buildInvestmentPositions>[number] | null>(null);
  const [resultForm,setResultForm] = useState<ReturnType<typeof createExecutionForm>|null>(null);
  const [executionMode,setExecutionMode] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [editingExecution, setEditingExecution] = useState<Execution | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<{ kind: "execution" | "snapshot"; id: string } | {kind:"asset";accountId:string;ticker:string} | null>(null);
  const [executionForm, setExecutionForm] = useState(createExecutionForm);
  const [snapshotForm, setSnapshotForm] = useState(createSnapshotForm);
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const tickerRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountsResult, executionsResult, snapshotsResult] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, currency, is_active").eq("user_id", user.id).eq("kind", "investment").order("is_active", { ascending: false }).order("name"),
        supabase.from("stock_executions").select("id, account_id, ticker, side, quantity, price, fee, executed_at, currency, note").eq("user_id", user.id).order("executed_at", { ascending: false }),
        supabase.from("account_equity_snapshots").select("id, account_id, recorded_at, equity, currency, note, financial_accounts!inner(kind)").eq("user_id", user.id).eq("financial_accounts.kind", "investment").order("recorded_at", { ascending: true }),
      ]);
      if (accountsResult.error) throw accountsResult.error;
      if (executionsResult.error) throw executionsResult.error;
      if (snapshotsResult.error) throw snapshotsResult.error;
      setAccounts((accountsResult.data ?? []) as Account[]);
      setExecutions((executionsResult.data ?? []) as Execution[]);
      setSnapshots((snapshotsResult.data ?? []) as Snapshot[]);
    } catch (error) {
      reportHandledError("Investments unavailable", error, "Portfolio belum berhasil dimuat.");
      setPageError(t("Portfolio belum berhasil dimuat. Coba lagi beberapa saat lagi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const currencies = useMemo(() => [...new Set([
    ...accounts.map((account) => account.currency),
    ...executions.map((execution) => execution.currency),
    ...snapshots.map((snapshot) => snapshot.currency),
  ])].sort(), [accounts, executions, snapshots]);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? "IDR";
  const positions = useMemo(() => buildInvestmentPositions(executions, currency), [currency, executions]);
  const filteredExecutions = useMemo(() => filterStockExecutions(executions, { side: sideFilter, search }, accountNames), [accountNames, executions, search, sideFilter]);
  const equitySeries = useMemo(() => buildPortfolioWeeklyEquitySeries(
    snapshots.map((item) => ({ accountId: item.account_id, recordedAt: item.recorded_at, equity: Number(item.equity), currency: item.currency })),
    currency,
  ), [currency, snapshots]);
  const openPositions = positions.filter((position) => position.summary.quantity > 0);
  const totalCostBasis = openPositions.reduce((total, position) => total + position.summary.costBasis, 0);
  const totalRealizedPnl = positions.reduce((total, position) => total + position.summary.realizedPnl, 0);
  const latestEquity = equitySeries.at(-1)?.equity ?? null;

  function openExecution() { setExecutionMode(false);const accountId = activeAccounts[0]?.id ?? ""; setEditingExecution(null); setExecutionForm(createExecutionForm(accountId)); setFormError(null); setExecutionOpen(true); }
  function openSnapshot() { const accountId = activeAccounts[0]?.id ?? ""; setEditingSnapshot(null); setSnapshotForm(createSnapshotForm(accountId)); setFormError(null); setSnapshotOpen(true); }
  function editExecution(execution: Execution) {
    setExecutionMode(true);
    setEditingExecution(execution);
    setExecutionForm({ assetCategory:decodeInvestmentNote(execution.note).category,assetName:decodeInvestmentNote(execution.note).name,accountId: execution.account_id, ticker: execution.ticker, side: execution.side, quantity: String(execution.quantity), price: String(execution.price), fee: String(execution.fee), executedAt: formatLocalDateTime(new Date(execution.executed_at)), note: decodeInvestmentNote(execution.note).note });
    setFormError(null); setExecutionOpen(true);
  }
  function editSnapshot(snapshot: Snapshot) {
    setEditingSnapshot(snapshot);
    setSnapshotForm({ accountId: snapshot.account_id, equity: String(snapshot.equity), recordedAt: formatLocalDateTime(new Date(snapshot.recorded_at)), note: snapshot.note ?? "" });
    setFormError(null); setSnapshotOpen(true);
  }

  useEffect(()=>{
    const view=params.get("view"),requested=params.get("id"),key=`${view}:${requested}`;
    if(loading||!view||openedView.current===key)return;
    const timer=window.setTimeout(()=>{
      openedView.current=key;
      if(view==="create"||view==="execution") {setExecutionMode(view==="execution");setEditingExecution(null);setExecutionForm(createExecutionForm(activeAccounts[0]?.id??""));setFormError(null);setExecutionOpen(true);}
      else if(view==="detail") {const position=requested?positions.find(item=>`${item.accountId}:${item.ticker}`===requested||item.ticker===requested):positions[0];if(position)setDetailPosition(position);}
      else if(view==="edit") {const record=requested?snapshots.find(item=>item.id===requested):snapshots[0];setEditingSnapshot(record??null);if(record)setSnapshotForm({accountId:record.account_id,equity:String(record.equity),recordedAt:formatLocalDateTime(new Date(record.recorded_at)),note:record.note??""});else if(!requested)setSnapshotForm(createSnapshotForm(activeAccounts[0]?.id??""));if(record||!requested){setFormError(null);setSnapshotOpen(true);}}
    },0);return()=>window.clearTimeout(timer);
  },[loading,params,positions,snapshots,activeAccounts]);

  async function saveExecution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (executionSaving.current) return;
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const assetCategory=executionForm.assetCategory??"stock";
    const enteredSymbol=executionForm.ticker.trim().toUpperCase();
    const prefix=`${assetCategory.toUpperCase()}-`;
    const symbol=assetCategory==="stock"?enteredSymbol:(enteredSymbol.startsWith(prefix)?enteredSymbol:`${prefix}${enteredSymbol||executionForm.assetName||""}`.toUpperCase().replace(/[^A-Z0-9.-]/g,"").slice(0,16));
    if(executionForm.assetCategory!=="stock"&&!executionForm.assetName?.trim()){setFormError(t("Isi nama aset."));return;}
    const validation = validateExecutionForm({...executionForm,ticker:symbol});
    if (validation) { setFormError(t(validation)); return; }
    const selectedAccount=accounts.find(item=>item.id===executionForm.accountId);
    if(!selectedAccount||(!selectedAccount.is_active&&selectedAccount.id!==editingExecution?.account_id)){setFormError(t("Pilih akun investasi yang aktif."));return;}
    if(executionForm.side==="sell"){
      const position=buildInvestmentPositions(executions.filter(item=>item.id!==editingExecution?.id),selectedAccount.currency).find(item=>item.accountId===executionForm.accountId&&item.ticker===symbol);
      if(Number(executionForm.quantity)>(position?.summary.quantity??0)){setFormError(t("Jumlah penjualan melebihi saham yang dimiliki."));return;}
      if(Number(executionForm.fee)>Number(executionForm.quantity)*Number(executionForm.price)){setFormError(t("Biaya tidak boleh melebihi nilai penjualan."));return;}
    }
    executionSaving.current=true;
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === executionForm.accountId);
      const record = { account_id: executionForm.accountId, ticker: symbol, side: executionForm.side, quantity: Number(executionForm.quantity), price: Number(executionForm.price), fee: Number(executionForm.fee), currency: account?.currency ?? "IDR", executed_at: new Date(executionForm.executedAt).toISOString(), note: encodeInvestmentNote(executionForm.assetCategory??"stock",executionForm.assetName??"",executionForm.note) };
      const { error } = editingExecution
        ? await supabase.from("stock_executions").update(record).eq("id", editingExecution.id).eq("user_id", user.id)
        : await supabase.from("stock_executions").insert({ user_id: user.id, ...record });
      if (error) throw error;
      setResultForm({...executionForm,ticker:symbol});setExecutionOpen(false); setEditingExecution(null); await loadData(); showToast(editingExecution ? "Eksekusi diperbarui." : "Eksekusi investasi disimpan.");
    } catch (error) { reportHandledError("Execution save failed", error, "Eksekusi belum berhasil disimpan."); setFormError(t("Eksekusi belum berhasil disimpan. Coba lagi.")); }
    finally { executionSaving.current=false;setSaving(false); }
  }

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateSnapshotForm(snapshotForm);
    if (validation) { setFormError(t(validation)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const account = accounts.find((item) => item.id === snapshotForm.accountId);
      const record = { account_id: snapshotForm.accountId, equity: Number(snapshotForm.equity), currency: account?.currency ?? "IDR", recorded_at: new Date(snapshotForm.recordedAt).toISOString(), note: snapshotForm.note.trim() || null };
      const { error } = editingSnapshot
        ? await supabase.from("account_equity_snapshots").update(record).eq("id", editingSnapshot.id).eq("user_id", user.id)
        : await supabase.from("account_equity_snapshots").insert({ user_id: user.id, ...record });
      if (error) throw error;
      setSnapshotOpen(false); setEditingSnapshot(null); await loadData(); showToast(editingSnapshot ? "Snapshot diperbarui." : "Snapshot equity disimpan.");
    } catch (error) { reportHandledError("Investment snapshot save failed", error, "Snapshot belum berhasil disimpan."); setFormError(t("Snapshot belum berhasil disimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function deleteRecord() {
    if (!recordToDelete) return;
    if (!canWriteOnline()) { setFormError(t(offlineWriteMessage)); return; }
    setSaving(true); setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing session");
      const table = recordToDelete.kind === "snapshot" ? "account_equity_snapshots" : "stock_executions";
      const request=supabase.from(table).delete().eq("user_id",user.id);
      const { error } = recordToDelete.kind==="asset" ? await request.eq("account_id",recordToDelete.accountId).eq("ticker",recordToDelete.ticker) : await request.eq("id",recordToDelete.id);
      if (error) throw error;
      setRecordToDelete(null); await loadData(); showToast("Catatan investasi dihapus.");
    } catch (error) {
      reportHandledError("Investment journal delete failed", error, "Catatan belum berhasil dihapus.");
      setFormError(t("Catatan belum berhasil dihapus. Coba lagi."));
    } finally { setSaving(false); }
  }

  return (
    <ReferenceRoot page="portofolio">
      <Navbar />
      {pageError&&<p role="alert" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-error-container p-3 text-error">{pageError}</p>}{loading?<main className="pt-20 px-margin" aria-busy="true"><InvestmentSkeleton/></main>:<PortfolioView positions={positions} executions={executions} currency={currency} currencies={currencies} setCurrency={setSelectedCurrency} equity={latestEquity} cost={totalCostBasis} pnl={totalRealizedPnl} accountNames={accountNames} onAdd={openExecution} onSnapshot={openSnapshot} onEdit={record=>{const actual=executions.find(item=>item.id===record.id);if(actual)editExecution(actual);}} onPosition={setDetailPosition}/>}


      {detailPosition&&<InvestmentDetail position={detailPosition} executions={executions} accountName={accountNames.get(detailPosition.accountId)??"—"} totalCost={totalCostBasis} onClose={()=>setDetailPosition(null)} onEdit={record=>{const actual=executions.find(item=>item.id===record.id);if(actual){setDetailPosition(null);editExecution(actual);}}} onDelete={()=>{setRecordToDelete({kind:"asset",accountId:detailPosition.accountId,ticker:detailPosition.ticker});setDetailPosition(null);setFormError(null);}} onTrade={side=>{setExecutionMode(true);setExecutionForm({...createExecutionForm(detailPosition.accountId),ticker:detailPosition.ticker,assetCategory:decodeInvestmentNote(executions.find(item=>item.account_id===detailPosition.accountId&&item.ticker===detailPosition.ticker)?.note).category,assetName:decodeInvestmentNote(executions.find(item=>item.account_id===detailPosition.accountId&&item.ticker===detailPosition.ticker)?.note).name,side});setEditingExecution(null);setFormError(null);setDetailPosition(null);setExecutionOpen(true);}}/>}
      {executionOpen && <InvestmentEditor accounts={editingExecution ? accounts : activeAccounts} form={executionForm} onChange={setExecutionForm} busy={saving} error={formError} editing={Boolean(editingExecution)} executionMode={executionMode} onDelete={editingExecution?()=>{setRecordToDelete({kind:"execution",id:editingExecution.id});setExecutionOpen(false);setFormError(null);}:undefined} onClose={() => !saving && setExecutionOpen(false)} onSave={saveExecution} />}
      {snapshotOpen && <SnapshotEditor accounts={editingSnapshot ? accounts : activeAccounts} form={snapshotForm} onChange={setSnapshotForm} busy={saving} error={formError} onClose={() => !saving && setSnapshotOpen(false)} onSave={saveSnapshot} />}
      {resultForm&&<InvestmentResult form={resultForm} accountName={accountNames.get(resultForm.accountId)??"—"} currency={accounts.find(item=>item.id===resultForm.accountId)?.currency??"IDR"} onClose={()=>setResultForm(null)} onDetail={()=>{const position=positions.find(item=>item.accountId===resultForm.accountId&&item.ticker===resultForm.ticker);setResultForm(null);if(position)setDetailPosition(position);}}/>}
      {recordToDelete&&recordToDelete.kind!=="snapshot"&&(()=>{const record=recordToDelete.kind==="execution"?executions.find(item=>item.id===recordToDelete.id):null;const position=recordToDelete.kind==="asset"?positions.find(item=>item.accountId===recordToDelete.accountId&&item.ticker===recordToDelete.ticker):null;return <InvestmentDelete ticker={record?.ticker??position?.ticker??"—"} currency={record?.currency??position?.currency??currency} quantity={record?.quantity??position?.summary.quantity??0} value={record?record.quantity*record.price:position?.summary.costBasis??0} count={record?1:executions.filter(item=>position&&item.account_id===position.accountId&&item.ticker===position.ticker).length} execution={Boolean(record)} busy={saving} error={formError} onClose={()=>!saving&&setRecordToDelete(null)} onConfirm={()=>void deleteRecord()}/>;})()}
      {recordToDelete?.kind==="snapshot"&&<ConfirmDialog titleId="investment-delete-title" descriptionId="investment-delete-description" title={t("Hapus snapshot?")} description={t("Snapshot ini akan dihapus permanen dari riwayat equity.")} confirmLabel={t("Hapus snapshot")} onClose={()=>!saving&&setRecordToDelete(null)} onConfirm={()=>void deleteRecord()} loading={saving} error={formError}/>}

    </ReferenceRoot>
  );
}

function Dialog({ title, eyebrow, description, saving, onClose, initialFocusRef, children }: { title: string; eyebrow: string; description: string; saving: boolean; onClose: () => void; initialFocusRef?: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <DialogFrame titleId="investment-dialog-title" descriptionId="investment-dialog-description" initialFocusRef={initialFocusRef} onClose={onClose} closeDisabled={saving}>
      <section>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p>
            <h2 id="investment-dialog-title" className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
            <p id="investment-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup form investasi")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </section>
    </DialogFrame>
  );
}
function DialogActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  const { t } = useLanguage();
  return (
    <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
      <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">{t("Batal")}</Button>
      <Button type="submit" loading={saving} className="flex-[1.4] sm:flex-none">{label}</Button>
    </div>
  );
}
function InvestmentSkeleton() { return <PageSkeleton variant="portfolio"/>; }
function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 4,
  }).format(Math.abs(Number(value)));
}
function formatSignedMoney(value: number, currency: string) { return `${value >= 0 ? "+" : "−"}${formatMoney(value, currency)}`; }
