"use client";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import {createTransactionOnce,TransactionWriteConflict} from "@/lib/transaction-write";
import {beginTransactionAttempt,finishTransactionAttempt,readTransactionAttempt} from "@/lib/transaction-attempt";
import { useFinancialRefresh } from "@/components/reference/useFinancialRefresh";

import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { ActivityView } from "@/components/reference/ActivityView";
import { ReferenceRoot } from "@/components/reference/runtime";
import {takePendingReceipt,takePendingExtraction} from "@/lib/pending-receipt";
import {DialogFrame} from "@/components/ui/DialogFrame";
import { TransactionDetail } from "@/components/reference/TransactionDetail";
import { EditTransactionEditor,TransactionEditor } from "@/components/reference/TransactionEditor";
import { TransactionDelete,TransactionResult } from "@/components/reference/TransactionFeedback";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { supabase } from "@/infrastructure/supabase/browser-client";
import {
buildCategoryFilterOptions,
buildTransactionCategoryOptions,
type CategoryRecord,
type CategoryType,
} from "@/lib/categories";
import { reportHandledError } from "@/lib/errors";
import { filterTransactions,type TransactionFilters } from "@/lib/finance";
import { getIdrRates,type FxRateResult } from "@/lib/fx";
import {
createQueuedTransactionOperation,
listQueuedTransactionOperations,
projectQueuedTransactionOperations,
queueTransactionOperation,
removeQueuedTransactionOperation,
replayQueuedTransactionOperations,
updateQueuedTransactionOperation,
type QueuedTransactionOperation,
} from "@/lib/offline-transaction-queue";
import { formatLocalDate } from "@/lib/planning";
import { canWriteOnline,offlineWriteMessage } from "@/lib/pwa";
import type { ReceiptExtraction } from "@/lib/receipt-vision";
import { buildFinancialReport,serializeFinancialReportCsv,serializeRichTransactionCsv,type FinancialReport } from "@/lib/reporting";
import { getPrivateReceiptObjectPath,validateSharedReceiptFile } from "@/lib/shared-receipt";
import { parseTransactionDate } from "@/lib/transaction-date";
import {
applyReceiptExtractionToTransactionForm,
canApproveTransaction,
getTransactionSaveStatus,
getTransactionStatusLabel,
hasActiveTransactionFilters,
validateTransactionForm
} from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { enUS,id as idLocale } from "date-fns/locale";
import {
CheckCircle2,
Edit3,
Eye,
RotateCcw,
Trash2
} from "lucide-react";
import { useRouter,useSearchParams } from "next/navigation";
import {
useCallback,
useEffect,
useMemo,
useRef,
useState,
type Dispatch,
type FormEvent,
type RefObject,
type SetStateAction
} from "react";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
  amount: number;
  note: string | null;
  source: string;
  receipt_url: string | null;
  raw_text: string | null;
  ai_confidence: number | null;
  status: "confirmed" | "pending_approval" | "needs_review" | "deleted";
  created_at: string;
  updated_at: string;
  account_id: string | null;
  syncPending?: boolean;
};

type FinancialAccount = {
  current_balance?: number;
  institution?: string;
  id: string;
  name: string;
  currency: string;
};

type TransactionFormState = {
  date: string;
  type: "income" | "expense";
  merchant: string;
  category: string;
  amount: string;
  note: string;
  accountId: string;
};


const defaultFilters: TransactionFilters = {
  search: "",
  category: "all",
  type: "all",
  status: "active",
  startDate: "",
  endDate: "",
};

function createDefaultForm(): TransactionFormState {
  return {
    date: formatLocalDate(new Date()),
    type: "expense",
    merchant: "",
    category: "",
    amount: "0",
    note: "",
    accountId: "",
  };
}

export default function TransactionsPage() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const dateLocale = language === "en" ? enUS : idLocale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const chosenDate = parseTransactionDate(searchParams.get("date"));
  const autoOpenedRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveLock=useRef(false);
  const draftId=useRef<string|null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Transaction | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [printIds,setPrintIds]=useState<string[]|null>(null);
  const [reportRates, setReportRates] = useState<Map<string, FxRateResult>>(new Map());
  const [queueUserId, setQueueUserId] = useState<string | null>(null);
  const [queuedOperations, setQueuedOperations] = useState<QueuedTransactionOperation[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const syncingQueueRef = useRef(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [conflictTarget, setConflictTarget] = useState<QueuedTransactionOperation | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(() => ({ ...defaultFilters, startDate: chosenDate ?? "", endDate: chosenDate ?? "" }));
  const [dateFiltersOpen, setDateFiltersOpen] = useState(Boolean(chosenDate));
  const [modalOpen, setModalOpen] = useState(false);
  const [savedResult,setSavedResult] = useState<{form:TransactionFormState;edited:boolean}|null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const openedDetailRef = useRef<string|null>(null);
  useEffect(()=>{const requested=searchParams.get("id");if(loading||searchParams.get("view")!=="detail"||!requested||openedDetailRef.current===requested)return;const record=transactions.find(item=>item.id===requested);if(record){openedDetailRef.current=requested;const timer=window.setTimeout(()=>setDetailTx(record),0);return()=>window.clearTimeout(timer);}},[loading,searchParams,transactions]);
  const [scanDerived, setScanDerived] = useState(false);
  const [form, setForm] = useState<TransactionFormState>(createDefaultForm);
  const merchantInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chosenDate) return;
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, startDate: chosenDate, endDate: chosenDate }));
      setDateFiltersOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [chosenDate]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setQueueUserId(null);
        setQueuedOperations([]);
        return;
      }

      const [transactionResult, accountResult, categoryResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("financial_accounts")
          .select("id, name, currency, current_balance, institution, kind")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("categories")
          .select("id, user_id, name, type, icon, color, created_at")
          .order("name", { ascending: true }),
      ]);

      if (transactionResult.error) throw transactionResult.error;
      if (accountResult.error) throw accountResult.error;
      if (categoryResult.error) throw categoryResult.error;
      setQueueUserId(user.id);
      setTransactions((transactionResult.data ?? []) as Transaction[]);
      setFinancialAccounts((accountResult.data ?? []) as FinancialAccount[]);
      setCategories((categoryResult.data ?? []) as CategoryRecord[]);
    } catch (error) {
      reportHandledError("Transactions unavailable", error, "Data transaksi belum berhasil dimuat.");
      setPageError("Data transaksi belum berhasil dimuat. Coba lagi beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFinancialRefresh(fetchTransactions);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTransactions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchTransactions]);

  const loadQueuedOperations = useCallback(async (userId: string) => {
    try {
      setQueuedOperations(await listQueuedTransactionOperations(userId));
    } catch (error) {
      reportHandledError("Offline queue unavailable", error, "Antrean offline belum dapat dibuka.");
      setQueueMessage("Antrean offline perangkat belum dapat dibuka.");
    }
  }, []);

  const syncQueuedOperations = useCallback(async () => {
    if (syncingQueueRef.current || !canWriteOnline()) return;
    syncingQueueRef.current = true;
    setSyncingQueue(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const results = await replayQueuedTransactionOperations(user.id, {
        create: async (operation) => {
          const payload=operation.payload;
          if(!payload.date||!payload.type||!payload.category||!payload.account_id||payload.amount===undefined)throw new Error("Invalid queued transaction");
          try {
            await createTransactionOnce(supabase,operation.transactionId,{user_id:user.id,date:payload.date,type:payload.type,category:payload.category,account_id:payload.account_id,amount:payload.amount,merchant:payload.merchant??null,note:payload.note??null,source:"manual",status:payload.status??"confirmed"});
            return "done";
          } catch(error) {
            if(error instanceof TransactionWriteConflict)return "conflict";
            throw error;
          }
        },
        edit: async (operation) => {
          const query = supabase.from("transactions").update({ ...operation.payload, source: "manual" }).eq("id", operation.transactionId).eq("user_id", user.id);
          const { data, error } = operation.baseUpdatedAt
            ? await query.eq("updated_at", operation.baseUpdatedAt).select("id")
            : await query.select("id");
          if (error) throw error;
          return data?.length ? "done" : "conflict";
        },
        softDelete: async (operation) => {
          const query = supabase.from("transactions").update({ status: "deleted" }).eq("id", operation.transactionId).eq("user_id", user.id);
          const { data, error } = operation.baseUpdatedAt
            ? await query.eq("updated_at", operation.baseUpdatedAt).select("id")
            : await query.select("id");
          if (error) throw error;
          return data?.length ? "done" : "conflict";
        },
      });
      await loadQueuedOperations(user.id);
      if (results.some((result) => result.state === "done")) await fetchTransactions();
      if (results.some((result) => result.state === "conflict")) setQueueMessage("Sebagian perubahan offline perlu ditinjau sebelum disinkronkan.");
    } catch (error) {
      reportHandledError("Offline queue sync failed", error, "Sinkronisasi offline belum berhasil.");
      setQueueMessage("Sinkronisasi offline belum berhasil. Perubahan tetap tersimpan di perangkat.");
    } finally {
      syncingQueueRef.current = false;
      setSyncingQueue(false);
    }
  }, [fetchTransactions, loadQueuedOperations]);

  useEffect(() => {
    if (!queueUserId) return;
    const timer = window.setTimeout(() => {
      void loadQueuedOperations(queueUserId);
      if (canWriteOnline()) void syncQueuedOperations();
    }, 0);
    const handleOnline = () => void syncQueuedOperations();
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [loadQueuedOperations, queueUserId, syncQueuedOperations]);

  const displayedTransactions = useMemo(
    () => projectQueuedTransactionOperations(transactions, queuedOperations) as Transaction[],
    [queuedOperations, transactions],
  );
  const filteredTx = useMemo(
    () => filterTransactions(displayedTransactions, filters).filter(tx=>!searchParams.get("account")||tx.account_id===searchParams.get("account")),
    [displayedTransactions, filters,searchParams],
  );
  const filteredServerTx = useMemo(
    () => filterTransactions(transactions, filters),
    [filters, transactions],
  );
  const queuedOperationByTransactionId = useMemo(
    () => new Map(queuedOperations.map((operation) => [operation.transactionId, operation])),
    [queuedOperations],
  );
  const accountNames = useMemo(
    () => new Map(financialAccounts.map((account) => [account.id, account.name])),
    [financialAccounts],
  );
  const accountCurrencies = useMemo(
    () => new Map(financialAccounts.map((account) => [account.id, account.currency])),
    [financialAccounts],
  );
  const report = useMemo<FinancialReport>(
    () => buildFinancialReport(filteredServerTx, accountNames, accountCurrencies, reportRates),
    [accountCurrencies, accountNames, filteredServerTx, reportRates],
  );
  const filtersActive = hasActiveTransactionFilters(filters);
  const isEditMode = selectedTx !== null;
  const filterCategoryOptions = useMemo(
    () => buildCategoryFilterOptions(categories, transactions.map((transaction) => transaction.category)),
    [categories, transactions],
  );
  const transactionCategoryOptions = useMemo(
    () => buildTransactionCategoryOptions(categories, form.type, selectedTx?.category),
    [categories, form.type, selectedTx?.category],
  );
  const filterSummary = useMemo(() => [
    filters.type !== "all" ? filters.type : null,
    filters.category !== "all" ? filters.category : null,
    filters.status !== "active" ? filters.status : null,
    filters.startDate ? `≥ ${filters.startDate}` : null,
    filters.endDate ? `≤ ${filters.endDate}` : null,
    filters.search.trim() || null,
  ].filter(Boolean).join(" · ") || "Semua transaksi", [filters]);

  const downloadCsv = (contents: string, filename: string) => {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const refreshReportRates = async () => {
    const currencies = filteredServerTx.flatMap((transaction) => {
      const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : null;
      return currency ? [currency] : [];
    });
    const rates = await getIdrRates(currencies);
    setReportRates(rates);
    return rates;
  };

  const exportLedger = () => {
    downloadCsv(serializeRichTransactionCsv(report), `fintrack-ledger-${formatLocalDate(new Date())}.csv`);
  };

  const exportReport = async () => {
    const rates = await refreshReportRates().catch(() => reportRates);
    const currentReport = buildFinancialReport(filteredServerTx, accountNames, accountCurrencies, rates);
    downloadCsv(
      serializeFinancialReportCsv(currentReport, { generatedAt: new Date().toISOString(), filterSummary }),
      `fintrack-report-${formatLocalDate(new Date())}.csv`,
    );
  };

  const printReport = async (ids:string[]) => {
    setPrintIds(ids);
    await refreshReportRates().catch(() => undefined);
    window.setTimeout(() => window.print(), 0);
  };

  const openAdd = useCallback(() => {
    draftId.current=null;
    setSelectedTx(null);
    const nextForm = createDefaultForm();
    let recoveredScan=false;
    if (chosenDate) nextForm.date = chosenDate;
    nextForm.category = buildTransactionCategoryOptions(categories, "expense")[0] ?? "";
    if(queueUserId){
      try {
        const pending=readTransactionAttempt(localStorage,queueUserId,"manual");
        if(pending){const p=pending.payload;recoveredScan=p.status==="needs_review";Object.assign(nextForm,{date:p.date,type:p.type,merchant:p.merchant??"",note:p.note??"",category:p.category,amount:String(p.amount),accountId:p.account_id});}
      } catch {
        setFormError("Draft pemulihan tidak dapat dibuka. Periksa penyimpanan perangkat sebelum mencoba lagi.");
        return;
      }
    }
    setForm(nextForm);
    setScanDerived(recoveredScan);
    setFormError(null);
    setModalOpen(true);
  }, [categories, chosenDate,queueUserId]);

  useEffect(() => {
    if (loading) return;

    const action = searchParams.get("new") === "1"
      ? "new"
      : searchParams.get("status") === "review"
        ? "review"
        : null;
    if (!action) {
      autoOpenedRef.current = null;
      return;
    }
    const actionKey = `${action}:${chosenDate ?? ""}`;
    if (autoOpenedRef.current === actionKey) return;

    const timer = window.setTimeout(() => {
      if (autoOpenedRef.current === actionKey) return;
      autoOpenedRef.current = actionKey;
      if (action === "new") {
        openAdd();
        const remainingParams=new URLSearchParams(searchParams.toString());remainingParams.delete("new");router.replace(`/transactions${remainingParams.size?`?${remainingParams}`:""}`, { scroll: false });
        return;
      }
      setFilters((current) => ({ ...current, status: "review" }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [chosenDate, loading, openAdd, router, searchParams]);

  const openEdit = (transaction: Transaction) => {
    setSelectedTx(transaction);
    setScanDerived(false);
    setForm({
      date: transaction.date,
      type: transaction.type,
      merchant: transaction.merchant ?? "",
      category: transaction.category,
      amount: String(transaction.amount),
      note: transaction.note ?? "",
      accountId: transaction.account_id ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(saveLock.current)return;
    if (!selectedTx && !form.note.trim()) { setFormError(t("Keterangan transaksi wajib diisi.")); return; }
    const validationError = validateTransactionForm(form);
    if (validationError || !form.category) {
      setFormError(validationError ?? "Pilih kategori sebelum menyimpan transaksi.");
      return;
    }

    const offline = !canWriteOnline();
    if (offline && selectedTx?.source && selectedTx.source !== "manual") {
      setFormError(offlineWriteMessage);
      return;
    }

    saveLock.current=true;
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Missing authenticated user");

      const offlinePayload = {
        date: form.date,
        type: form.type,
        merchant: form.merchant.trim() || null,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || null,
        source: "manual" as const,
        account_id: form.accountId,
      };
      const onlinePayload = {
        ...offlinePayload,
        source: selectedTx?.source ?? "manual",
        status: getTransactionSaveStatus(selectedTx?.status, scanDerived),
      };

      if (offline) {
        if(!selectedTx&&readTransactionAttempt(localStorage,user.id,"manual"))throw new TransactionWriteConflict();
        draftId.current??=crypto.randomUUID();
        const transactionId = selectedTx?.id ?? draftId.current;
        await queueTransactionOperation(createQueuedTransactionOperation({
          userId: user.id,
          kind: selectedTx ? "edit" : "create",
          transactionId,
          payload: selectedTx ? offlinePayload : { ...offlinePayload, id: transactionId, ...(scanDerived ? { status: "needs_review" as const } : {}) },
          baseUpdatedAt: selectedTx?.updated_at ?? null,
        }));
        await loadQueuedOperations(user.id);
        setModalOpen(false);
        setQueueMessage("Perubahan manual disimpan di perangkat dan menunggu sinkronisasi.");
        showToast("Perubahan disimpan di perangkat dan akan disinkronkan.", "info");
        return;
      }

      if(isEditMode){
        const result=await supabase.from("transactions").update(onlinePayload).eq("id",selectedTx.id).eq("user_id",user.id);
        if(result.error)throw result.error;
      }else{
        const attempt=beginTransactionAttempt(localStorage,"manual",{user_id:user.id,...onlinePayload});
        draftId.current=attempt.id;
        await createTransactionOnce(supabase,attempt.id,attempt.payload);
        finishTransactionAttempt(localStorage,user.id,"manual",attempt.id);
      }

      window.dispatchEvent(new Event("fintrack:setup-data-saved"));
      setSavedResult({form:{...form},edited:isEditMode});
      setModalOpen(false);
      await fetchTransactions();
      showToast(isEditMode ? "Transaksi diperbarui." : "Transaksi disimpan.");
    } catch (error) {
      reportHandledError("Transaction save failed", error, "Transaksi belum berhasil disimpan.");
      setFormError(t(error instanceof TransactionWriteConflict?error.message:"Transaksi belum berhasil disimpan. Coba lagi."));
    } finally {
      saveLock.current=false;
      setSaving(false);
    }
  };

  const requestApproval = (transaction: Transaction) => {
    setApproveTarget(transaction);
    setApproveError(null);
  };

  const handleApprove = async () => {
    if (!approveTarget || approvingId || !canApproveTransaction(approveTarget.status)) return;
    if (!canWriteOnline()) {
      setApproveError(offlineWriteMessage);
      return;
    }

    setApprovingId(approveTarget.id);
    setApproveError(null);
    try {
      const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", approveTarget.id);
      if (error) throw error;
      setApproveTarget(null);
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction approval failed", error, "Transaksi belum berhasil disetujui.");
      setApproveError("Transaksi belum berhasil disetujui. Coba lagi.");
    } finally {
      setApprovingId(null);
    }
  };

  const requestDelete = (transaction: Transaction) => {
    setDeleteTarget(transaction);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deletingId) return;
    const offline = !canWriteOnline();
    if (offline && deleteTarget.source !== "manual") {
      setDeleteError(offlineWriteMessage);
      return;
    }

    const transactionId = deleteTarget.id;
    setDeletingId(transactionId);
    setDeleteError(null);
    try {
      if (offline) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Missing authenticated user");
        await queueTransactionOperation(createQueuedTransactionOperation({
          userId: user.id,
          kind: "soft-delete",
          transactionId,
          payload: { status: "deleted", source: "manual" },
          baseUpdatedAt: deleteTarget.updated_at,
        }));
        await loadQueuedOperations(user.id);
        setQueueMessage("Penghapusan manual disimpan di perangkat dan menunggu sinkronisasi.");
      } else {
        const { error } = await supabase.from("transactions").update({ status: "deleted" }).eq("id", transactionId);
        if (error) throw error;
        await fetchTransactions();
      }
      setDeleteTarget(null);
    } catch (error) {
      reportHandledError("Transaction delete failed", error, "Transaksi belum berhasil dihapus.");
      setDeleteError("Transaksi belum berhasil dihapus. Coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (transactionId: string) => {
    if (restoringId) return;
    if (!canWriteOnline()) {
      setPageError(offlineWriteMessage);
      return;
    }

    setRestoringId(transactionId);
    try {
      const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", transactionId);
      if (error) throw error;
      await fetchTransactions();
    } catch (error) {
      reportHandledError("Transaction restore failed", error, "Transaksi belum berhasil dipulihkan.");
      setPageError("Transaksi belum berhasil dipulihkan. Coba lagi.");
    } finally {
      setRestoringId(null);
    }
  };

  const discardQueuedOperation = async () => {
    if (!conflictTarget || resolvingConflict || !queueUserId) return;
    setResolvingConflict(true);
    setConflictError(null);
    try {
      await removeQueuedTransactionOperation(conflictTarget.opId);
      await loadQueuedOperations(queueUserId);
      await fetchTransactions();
      setConflictTarget(null);
      setQueueMessage("Perubahan offline dibuang. Data server dipertahankan.");
    } catch (error) {
      reportHandledError("Offline queue conflict discard failed", error, "Perubahan offline belum dapat dibuang.");
      setConflictError("Perubahan offline belum dapat dibuang. Coba lagi.");
    } finally {
      setResolvingConflict(false);
    }
  };

  const retryQueuedOperation = async (operation: QueuedTransactionOperation) => {
    if (resolvingConflict || !queueUserId || !canWriteOnline()) return;
    setResolvingConflict(true);
    setConflictError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== queueUserId) throw new Error("Missing authenticated user");
      const { data: serverRow, error } = await supabase
        .from("transactions")
        .select("id, updated_at")
        .eq("id", operation.transactionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!serverRow && operation.kind !== "create") {
        setQueueMessage("Data server sudah tidak tersedia. Buang perubahan offline atau buat transaksi baru.");
        return;
      }
      await updateQueuedTransactionOperation({
        ...operation,
        baseUpdatedAt: serverRow?.updated_at ?? null,
        attempts: 0,
        state: "pending",
        lastError: null,
      });
      await loadQueuedOperations(user.id);
      setQueueMessage("Perubahan offline siap dicoba ulang dengan versi server terbaru.");
      await syncQueuedOperations();
    } catch (error) {
      reportHandledError("Offline queue conflict retry failed", error, "Perubahan offline belum dapat disiapkan ulang.");
      setQueueMessage("Perubahan offline belum dapat disiapkan ulang. Coba lagi.");
    } finally {
      setResolvingConflict(false);
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setDateFiltersOpen(false);
    if (searchParams.has("date")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("date");
      const query = params.toString();
      router.replace(query ? `/transactions?${query}` : "/transactions", { scroll: false });
    }
  };

  const pendingQueuedOperations = queuedOperations.filter((operation) => operation.state === "pending");
  const conflictQueuedOperations = queuedOperations.filter((operation) => operation.state === "conflict");

  return (
    <ReferenceRoot page="aktivitas">
      <Navbar />
      {pageError&&<p role="alert" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-error-container p-3 text-error">{pageError}</p>}{loading?<main className="pt-20 px-margin" aria-busy="true"><PageSkeleton variant="activity"/></main>:!pageError&&<ActivityView transactions={displayedTransactions} filtered={filteredTx} accounts={financialAccounts} filters={filters} setFilters={next=>{setFilters(next);if(chosenDate&&(next.startDate!==chosenDate||next.endDate!==chosenDate)){const params=new URLSearchParams(searchParams.toString());params.delete("date");router.replace(`/transactions${params.size?`?${params}`:""}`,{scroll:false});}}} initialDate={chosenDate} onOpen={tx=>{const actual=displayedTransactions.find(item=>item.id===tx.id);if(actual)setDetailTx(actual);}} onAdd={date=>{openAdd();if(date)setForm(current=>({...current,date}));}} onExport={ids=>{const selected=new Set(ids);downloadCsv(serializeRichTransactionCsv(buildFinancialReport(transactions.filter(tx=>selected.has(tx.id)),accountNames,accountCurrencies,reportRates)),`fintrack-transaksi-${formatLocalDate(new Date())}.csv`);}} onPrint={ids=>void printReport(ids)}/>}
      {queuedOperations.length>0&&<section aria-label={t("Sinkronisasi transaksi")} className="mx-margin mb-24 rounded-[24px] bg-surface-container-lowest p-space-lg shadow-sm"><h2 className="text-headline-sm font-headline-sm">{t("Sinkronisasi transaksi")}</h2><p role="status" className="mt-2 text-body-sm text-on-surface-variant">{syncingQueue?t("Menyinkronkan data..."):`${pendingQueuedOperations.length} ${t("menunggu sinkronisasi")} · ${conflictQueuedOperations.length} ${t("perlu ditinjau")}`}</p>{queueMessage&&<p className="mt-2 text-body-sm text-on-surface-variant">{t(queueMessage)}</p>}<div className="mt-3 flex flex-col gap-3">{queuedOperations.map(operation=><QueueOperationStatus key={operation.opId} operation={operation} onRetry={retryQueuedOperation} onDiscard={setConflictTarget}/>)}</div></section>}
      <PrintReport report={printIds?buildFinancialReport(transactions.filter(tx=>printIds.includes(tx.id)),accountNames,accountCurrencies,reportRates):report} filterSummary={printIds?t("Transaksi sesuai periode dan filter yang dipilih"):filterSummary}/>


      {detailTx&&<TransactionDetail transaction={detailTx} accountName={accountNames.get(detailTx.account_id??"")??"—"} accountInstitution={financialAccounts.find(account=>account.id===detailTx.account_id)?.institution??undefined} currency={accountCurrencies.get(detailTx.account_id??"")??"IDR"} onClose={()=>setDetailTx(null)} onEdit={()=>{openEdit(detailTx);setDetailTx(null);}} onDelete={()=>{requestDelete(detailTx);setDetailTx(null);}} extra={canApproveTransaction(detailTx.status)?<div className="flex gap-3"><button type="button" disabled={Boolean(approvingId)||Boolean(deletingId)} onClick={()=>requestApproval(detailTx)} className="flex-1 rounded-full bg-primary-container px-4 py-3 font-semibold text-white" style={{color:"#fff"}}><CheckCircle2 className="mr-2 inline h-4 w-4"/>{t("Setujui")}</button><button type="button" disabled={Boolean(approvingId)||Boolean(deletingId)} onClick={()=>requestDelete(detailTx)} className="flex-1 rounded-full bg-error-container px-4 py-3 font-semibold text-error"><Trash2 className="mr-2 inline h-4 w-4"/>{t("Tolak")}</button></div>:detailTx.status!=="confirmed"?<TransactionActions transaction={detailTx} onEdit={openEdit} onDelete={requestDelete} onRestore={handleRestore} onApprove={requestApproval} deletingId={deletingId} restoringId={restoringId} approvingId={approvingId}/>:undefined}/>}
      {approveTarget && (
        <ConfirmDialog
          titleId="approve-transaction-title"
          descriptionId="approve-transaction-description"
          title={t("Setujui “{name}”?", { name: approveTarget.merchant || approveTarget.category })}
          description={t("Transaksi ini akan menjadi terkonfirmasi dan mengubah saldo akun.")}
          confirmLabel={t("Setujui transaksi")}
          onClose={() => {
            if (!approvingId) {
              setApproveTarget(null);
              setApproveError(null);
            }
          }}
          onConfirm={() => void handleApprove()}
          loading={Boolean(approvingId)}
          error={approveError}
        />
      )}

      {deleteTarget&&<TransactionDelete transaction={deleteTarget} accountName={accountNames.get(deleteTarget.account_id??"")??"—"} currency={accountCurrencies.get(deleteTarget.account_id??"")??"IDR"} busy={Boolean(deletingId)} error={deleteError} onClose={()=>{if(!deletingId){setDeleteTarget(null);setDeleteError(null);}}} onConfirm={()=>void handleDelete()}/>}
      {savedResult&&<TransactionResult form={savedResult.form} edited={savedResult.edited} accountName={accountNames.get(savedResult.form.accountId)??"—"} currency={accountCurrencies.get(savedResult.form.accountId)??"IDR"} onClose={()=>setSavedResult(null)} onAdd={()=>{setSavedResult(null);openAdd();}}/>}
      {conflictTarget && (
        <ConfirmDialog
          titleId="discard-offline-operation-title"
          descriptionId="discard-offline-operation-description"
          title={t("Buang perubahan offline?")}
          description={t("Perubahan lokal akan dihapus. Data server tetap dipertahankan.")}
          confirmLabel={t("Buang perubahan offline")}
          onClose={() => {
            if (!resolvingConflict) {
              setConflictTarget(null);
              setConflictError(null);
            }
          }}
          onConfirm={() => void discardQueuedOperation()}
          loading={resolvingConflict}
          error={conflictError}
        />
      )}

      {modalOpen && (
        <TransactionDialog
          form={form}
          setForm={setForm}
          accounts={financialAccounts}
          categories={categories}
          categoryOptions={transactionCategoryOptions}
          transaction={selectedTx}
          isEditMode={isEditMode}
          saving={saving}
          error={formError}
          merchantInputRef={merchantInputRef}
          onScan={() => setScanDerived(true)}
          onClose={closeModal}
          onSubmit={handleSave}
        />
      )}
    </ReferenceRoot>
  );
}

function PrintReport({ report, filterSummary }: { report: FinancialReport; filterSummary: string }) {
  const { t } = useLanguage();
  return (
    <section data-print-report className="hidden">
      <h1>{t("Laporan FinTrack")}</h1>
      <p>{t("Dibuat")} {new Date().toLocaleString("id-ID")}</p>
      <p>{t("Filter")}: {filterSummary}</p>
      <h2>{t("Ringkasan per mata uang")}</h2>
      <table><thead><tr><th scope="col">{t("Mata uang")}</th><th scope="col">{t("Pemasukan")}</th><th scope="col">{t("Pengeluaran")}</th><th scope="col">{t("Bersih")}</th><th scope="col">{t("Kurs")}</th></tr></thead><tbody>
        {report.currencyGroups.map((group) => <tr key={group.currency}><td>{group.currency}</td><td>{formatCurrency(group.income, group.currency)}</td><td>{formatCurrency(group.expense, group.currency)}</td><td>{formatCurrency(group.net, group.currency)}</td><td>{group.rate.rate === null ? t("Tidak tersedia") : `Frankfurter · ${group.rate.providerDate ?? "—"} · ${group.rate.state}`}</td></tr>)}
      </tbody></table>
      <h2>{t("Kategori pengeluaran terkonfirmasi")}</h2>
      <table><thead><tr><th scope="col">{t("Mata uang")}</th><th scope="col">{t("Kategori")}</th><th scope="col">{t("Jumlah")}</th></tr></thead><tbody>
        {report.categoryTotals.map((item) => <tr key={`${item.currency}-${item.category}`}><td>{item.currency}</td><td>{t(item.category)}</td><td>{formatCurrency(item.amount, item.currency)}</td></tr>)}
      </tbody></table>
      <h2>{t("Ledger transaksi")}</h2>
      <table><caption>{t("Transaksi sesuai filter aktif")}</caption><thead><tr><th scope="col">{t("Tanggal")}</th><th scope="col">{t("Tipe transaksi")}</th><th scope="col">{t("Merchant atau sumber")}</th><th scope="col">{t("Kategori")}</th><th scope="col">{t("Jumlah")}</th><th scope="col">{t("Mata uang")}</th><th scope="col">{t("Akun")}</th><th scope="col">{t("Status")}</th></tr></thead><tbody>
        {report.rows.map((row, index) => <tr key={`${row.date}-${row.account}-${index}`}><td>{row.date}</td><td>{t(row.type === "income" ? "Pemasukan" : "Pengeluaran")}</td><td>{row.merchant ?? ""}</td><td>{t(row.category)}</td><td>{formatCurrency(row.amount, row.currency)}</td><td>{row.currency}</td><td>{row.account}</td><td>{t(getTransactionStatusLabel(row.status))}</td></tr>)}
      </tbody></table>
    </section>
  );
}

function QueueOperationStatus({ operation, onRetry, onDiscard, compact = false }: {
  operation?: QueuedTransactionOperation;
  onRetry: (operation: QueuedTransactionOperation) => Promise<void>;
  onDiscard: (operation: QueuedTransactionOperation) => void;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  if (!operation) return null;
  if (operation.state === "conflict") {
    return (
      <span className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-rose-700">
        {t("Konflik sinkronisasi")}
        <Button variant="ghost" size="compact" className="min-h-7 px-1.5 text-[11px]" onClick={() => void onRetry(operation)}>{t("Coba ulang")}</Button>
        <Button variant="ghost" size="compact" className="min-h-7 px-1.5 text-[11px]" onClick={() => onDiscard(operation)}>{t("Buang")}</Button>
      </span>
    );
  }
  return (
    <span aria-live="polite" className="text-[11px] font-semibold text-sky-700">
      {t("Sinkronisasi tertunda")}{operation.attempts > 0 ? ` · ${t("Percobaan")} ${operation.attempts}` : ""}
      {!compact && operation.lastError ? ` · ${operation.lastError}` : ""}
    </span>
  );
}

function TransactionActions({ transaction, onEdit, onDelete, onRestore, onApprove, deletingId, restoringId, approvingId }: {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onRestore: (transactionId: string) => Promise<void>;
  onApprove: (transaction: Transaction) => void;
  deletingId: string | null;
  restoringId: string | null;
  approvingId: string | null;
}) {
  const { t } = useLanguage();
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [openingReceipt, setOpeningReceipt] = useState(false);

  const openReceipt = async () => {
    if (openingReceipt || !transaction.receipt_url) return;
    setOpeningReceipt(true);
    setReceiptError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Missing authenticated user");
      const objectPath = getPrivateReceiptObjectPath(transaction.receipt_url, user.id);
      if (!objectPath) throw new Error("Invalid receipt path");
      const { data, error } = await supabase.storage.from("receipts").createSignedUrl(objectPath, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Receipt URL unavailable");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      reportHandledError("Receipt signed URL failed", error, "Struk belum dapat dibuka.");
      setReceiptError(t("Struk belum dapat dibuka. Coba lagi."));
    } finally {
      setOpeningReceipt(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {transaction.receipt_url && !transaction.syncPending && (
        <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg" onClick={() => void openReceipt()} loading={openingReceipt} aria-label={t("Lihat struk {name}", { name: transaction.merchant || transaction.category })}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {!transaction.syncPending && (transaction.status === "deleted" ? (
        <Button variant="secondary" size="compact" onClick={() => void onRestore(transaction.id)} loading={restoringId === transaction.id}>
          <RotateCcw className="h-3.5 w-3.5" /> {t("Pulihkan")}
        </Button>
      ) : (
        <>
          {canApproveTransaction(transaction.status) && (
            <Button variant="secondary" size="compact" onClick={() => onApprove(transaction)} loading={approvingId === transaction.id}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("Setujui")}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg" onClick={() => onEdit(transaction)} aria-label={t("Edit {name}", { name: transaction.merchant || transaction.category })}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 min-h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onDelete(transaction)} disabled={Boolean(deletingId)} aria-label={t("Hapus {name}", { name: transaction.merchant || transaction.category })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      ))}
      {receiptError && <p role="alert" className="basis-full text-right text-[11px] text-rose-700">{receiptError}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const { t } = useLanguage();
  const tones = {
    confirmed: "bg-emerald-50 text-emerald-700",
    pending_approval: "bg-amber-50 text-amber-700",
    needs_review: "bg-rose-50 text-rose-700",
    deleted: "bg-slate-100 text-slate-500",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", tones[status])}>{t(getTransactionStatusLabel(status))}</span>;
}

function TransactionDialog({ form, setForm, accounts, categories, categoryOptions, transaction, isEditMode, saving, error, merchantInputRef, onScan, onClose, onSubmit }: {
  form: TransactionFormState;
  setForm: Dispatch<SetStateAction<TransactionFormState>>;
  accounts: FinancialAccount[];
  categories: CategoryRecord[];
  categoryOptions: string[];
  transaction: Transaction | null;
  isEditMode: boolean;
  saving: boolean;
  error: string | null;
  merchantInputRef: RefObject<HTMLInputElement | null>;
  onScan: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const captureParams=useSearchParams();
  const [photoChoice,setPhotoChoice]=useState(false);
  useEffect(()=>{if(captureParams.get("capture")!=="1")return;const timer=window.setTimeout(()=>setPhotoChoice(true),0);return()=>window.clearTimeout(timer);},[captureParams]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  const changeType = (type: CategoryType) => {
    const options = buildTransactionCategoryOptions(categories, type);
    setForm((current) => ({ ...current, type, category: options.includes(current.category) ? current.category : options[0] ?? "" }));
  };
  const clearReceiptSelection = () => {
    if (receiptInputRef.current) receiptInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setReceiptSuccess(null);
    setReceiptError(null);
  };
  const receiptAbortRef=useRef<AbortController|null>(null);
  useEffect(()=>()=>receiptAbortRef.current?.abort(),[]);
  const scanReceipt = useCallback(async (file: File) => {
    const validationError = validateSharedReceiptFile(file);
    if (validationError) {
      setReceiptSuccess(null);
      setReceiptError(t(validationError));
      return;
    }
    if (!canWriteOnline()) {
      setReceiptSuccess(null);
      setReceiptError(t(offlineWriteMessage));
      return;
    }
    receiptAbortRef.current?.abort();
    const controller=new AbortController();
    receiptAbortRef.current=controller;
    setScanningReceipt(true);
    setReceiptSuccess(null);
    setReceiptError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if(controller.signal.aborted)return;
      if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
        cache: "no-store",
        signal:controller.signal,
      });
      const result = await response.json().catch(() => ({})) as { extraction?: ReceiptExtraction; error?: string };
      if(controller.signal.aborted)return;
      if (!response.ok || !result.extraction) throw new Error(result.error || "AI belum bisa menganalisis struk. Silakan isi form manual.");
      setForm((current) => applyReceiptExtractionToTransactionForm(
        current,
        result.extraction!,
        buildTransactionCategoryOptions(categories, result.extraction?.type ?? current.type),
      ));
      onScan();
      const summary = [
        result.extraction.type === "income" ? t("Pemasukan") : result.extraction.type === "expense" ? t("Pengeluaran") : null,
        result.extraction.merchant,
        result.extraction.amount === null ? null : String(result.extraction.amount),
      ].filter(Boolean).join(" · ");
      if (summary) setScanHistory((current) => [summary, ...current].slice(0, 3));
      setReceiptSuccess(t("Data struk berhasil diekstrak otomatis. Periksa kembali sebelum menyimpan."));
    } catch (error) {
      if(!controller.signal.aborted)setReceiptError(t(error instanceof Error ? error.message : "AI belum bisa menganalisis struk. Silakan isi form manual."));
    } finally {
      if (receiptInputRef.current) receiptInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if(!controller.signal.aborted)setScanningReceipt(false);
    }
  }, [categories,setForm,onScan,t]);
  useEffect(()=>{if(captureParams.get("receipt")!=="1")return;const timer=window.setTimeout(()=>{const file=takePendingReceipt();const extraction=takePendingExtraction();if(file&&extraction){setForm(current=>applyReceiptExtractionToTransactionForm(current,extraction,buildTransactionCategoryOptions(categories,extraction.type??current.type)));onScan();}else if(file)void scanReceipt(file);},0);return()=>window.clearTimeout(timer);},[captureParams,categories,setForm,onScan,scanReceipt]);
  if (isEditMode) return <EditTransactionEditor form={form} onChange={next=>setForm({...form,...next})} accounts={accounts} categories={categoryOptions} busy={saving} error={error} onClose={onClose} onSave={onSubmit} transactionId={transaction?.id}/>;
  return <><TransactionEditor form={form} onChange={next=>setForm({...form,...next})} accounts={accounts} categories={categoryOptions} busy={saving || scanningReceipt} error={error || receiptError} onClose={onClose} onSave={onSubmit} attachment={<>
    <input ref={receiptInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event=>{const file=event.target.files?.[0];if(file)void scanReceipt(file);}}/>
    <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={event=>{const file=event.target.files?.[0];if(file)void scanReceipt(file);}}/>
    {scanningReceipt&&<p role="status" className="text-body-sm text-on-surface-variant">{t("Membaca struk...")}</p>}
    {receiptSuccess&&<p role="status" className="mt-2 text-body-sm text-primary">{receiptSuccess}</p>}
  </>}/>{photoChoice&&<DialogFrame titleId="receipt-source-title" onClose={()=>setPhotoChoice(false)}><div className="p-5 flex flex-col gap-4"><h2 id="receipt-source-title" className="text-headline-sm font-bold">{t("Foto struk")}</h2><p className="text-body-sm text-on-surface-variant">{t("Gemini membaca struk dan mengisi data transaksi. Periksa hasilnya sebelum menyimpan.")}</p><div className="flex gap-3"><Button type="button" className="flex-1" onClick={()=>{cameraInputRef.current?.click();setPhotoChoice(false);}}>{t("Kamera")}</Button><Button type="button" variant="secondary" className="flex-1" onClick={()=>{receiptInputRef.current?.click();setPhotoChoice(false);}}>{t("Galeri")}</Button></div></div></DialogFrame>}</>;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("id-ID")}`;
  }
}
