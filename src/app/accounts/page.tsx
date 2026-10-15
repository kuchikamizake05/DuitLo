"use client";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import { useFinancialRefresh } from "@/components/reference/useFinancialRefresh";
import { useSearchParams } from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";
import {readAccountDisplay,saveAccountDisplay} from "@/lib/account-display";
import Navbar from "@/components/Navbar";
import { AccountEditor,TransferEditor } from "@/components/reference/AccountEditors";
import { ReferenceRoot } from "@/components/reference/runtime";
import { WalletView } from "@/components/reference/WalletView";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogFrame as AccessibleDialogFrame } from "@/components/ui/DialogFrame";
import { Field,fieldControlStyles } from "@/components/ui/Field";
import { Surface } from "@/components/ui/Surface";
import { supabase } from "@/infrastructure/supabase/browser-client";
import {
filterAccounts,
getMissingForeignAccounts,
summarizeAccounts,
validateAccountForm,
validateTransferForm,
type AccountFilter,
type AccountOverviewRecord
} from "@/lib/accounts";
import { reportHandledError } from "@/lib/errors";
import { getIdrRates,type FxRateResult } from "@/lib/fx";
import type { FinancialAccountKind } from "@/lib/ledger";
import { formatLocalDate } from "@/lib/planning";
import { canWriteOnline,offlineWriteMessage } from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { enUS,id as idLocale } from "date-fns/locale";
import {
Building2,
ChartNoAxesCombined,
Landmark,
Smartphone,
X
} from "lucide-react";
import {
useCallback,
useEffect,
useMemo,
useRef,
useState,
type Dispatch,
type FormEvent,
type ReactNode,
type RefObject,
type SetStateAction,
} from "react";

const accountKinds: Array<{ value: FinancialAccountKind; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-wallet" },
  { value: "investment", label: "Investasi" },
  { value: "trading", label: "Trading" },
  { value: "liability", label: "Kewajiban" },
];

const accountFilters: Array<{ value: AccountFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "liquid", label: "Dana likuid" },
  { value: "investment", label: "Investasi" },
  { value: "trading", label: "Trading" },
  { value: "liability", label: "Kewajiban" },
];

const kindIcon = {
  bank: Landmark,
  ewallet: Smartphone,
  investment: ChartNoAxesCombined,
  trading: ChartNoAxesCombined,
  liability: Building2,
};

const emptyAccountForm = {
  name: "",
  institution: "",
  isCash: false,
  kind: "bank" as FinancialAccountKind,
  currency: "IDR",
  currentBalance: "0",
  reportingBalanceIdr: "",
  cardColor:"green",
  includeInNetWorth:true,
};

const createTransferForm = () => ({
  sourceAccountId: "",
  destinationAccountId: "",
  amount: "",
  destinationAmount: "",
  date: formatLocalDate(new Date()),
  kind: "transfer",
  note: "",
});

type AccountFormState = typeof emptyAccountForm;
type TransferFormState = ReturnType<typeof createTransferForm>;
type BalanceFormState = { currentBalance: string; reportingBalanceIdr: string };
type TransferRecord = {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  destination_amount: number;
  currency: string;
  destination_currency: string;
  date: string;
  note: string | null;
};
type ReconciliationRecord = {
  id: string;
  account_id: string;
  statement_balance: number;
  ledger_balance: number;
  reconciled_at: string;
  note: string | null;
};
type DialogKind = "account" | "transfer" | "balance" | null;
type AccountDialogMode = "create" | "edit";

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value);
}

export default function AccountsPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
  const params=useSearchParams();
  const openedView=useRef<string|null>(null);
  const [accounts, setAccounts] = useState<AccountOverviewRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [fxRefreshMessage, setFxRefreshMessage] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<Map<string, FxRateResult>>(new Map());
  const [activeDialog, setActiveDialog] = useState<DialogKind>(null);
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("all");
  const [balanceAccount, setBalanceAccount] = useState<AccountOverviewRecord | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountOverviewRecord | null>(null);
  const [accountToToggle, setAccountToToggle] = useState<AccountOverviewRecord | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<AccountOverviewRecord | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormState>(emptyAccountForm);
  const [transferForm, setTransferForm] = useState<TransferFormState>(createTransferForm);
  const [balanceForm, setBalanceForm] = useState<BalanceFormState>({ currentBalance: "", reportingBalanceIdr: "" });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLSelectElement>(null);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [accountsResult, transfersResult, reconciliationsResult] = await Promise.all([
        supabase
          .from("financial_accounts")
          .select("id, name, institution, kind, currency, current_balance, reporting_balance_idr, is_active, updated_at")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("account_transfers")
          .select("id, source_account_id, destination_account_id, amount, destination_amount, currency, destination_currency, date, note")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5),
        supabase
          .from("account_reconciliations")
          .select("id, account_id, statement_balance, ledger_balance, reconciled_at, note")
          .eq("user_id", user.id)
          .order("reconciled_at", { ascending: false })
          .limit(5),
      ]);
      const error = accountsResult.error || transfersResult.error || reconciliationsResult.error;
      if (error) throw error;
      setAccounts(((accountsResult.data ?? []) as AccountOverviewRecord[]).map((account,index)=>{const display=readAccountDisplay(user.id,account.id);return {...account,...display,cardColor:display.cardColor||["royal-blue","green","green","slate"][index%4]};}));
      setTransfers((transfersResult.data ?? []) as TransferRecord[]);
      setReconciliations((reconciliationsResult.data ?? []) as ReconciliationRecord[]);
    } catch (error) {
      reportHandledError("Accounts unavailable", error, "Data akun belum berhasil dimuat.");
      setPageError(t("Data akun belum berhasil dimuat. Coba lagi beberapa saat lagi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFinancialRefresh(loadAccounts);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  const closeDialog = useCallback(() => {
    if (saving) return;
    setActiveDialog(null);
    setEditingAccount(null);
    setFormError(null);
    setFormErrors({});
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }, [saving]);

  const summary = useMemo(() => summarizeAccounts(accounts), [accounts]);
  const missingForeignAccounts = useMemo(() => getMissingForeignAccounts(accounts), [accounts]);
  const filteredAccounts = useMemo(() => filterAccounts(accounts, activeFilter), [accounts, activeFilter]);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);
  const sourceAccount = activeAccounts.find((account) => account.id === transferForm.sourceAccountId);
  const destinationAccount = activeAccounts.find((account) => account.id === transferForm.destinationAccountId);
  const isCrossCurrencyTransfer = Boolean(sourceAccount && destinationAccount && sourceAccount.currency !== destinationAccount.currency);

  function rememberTrigger() {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function openAccountDialog() {
    rememberTrigger();
    setEditingAccount(null);
    setAccountForm(emptyAccountForm);
    setFormError(null);
    setFormErrors({});
    setActiveDialog("account");
  }

  function openEditAccountDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setEditingAccount(account);
    setAccountForm({
      cardColor:account.cardColor||"green",
      includeInNetWorth:account.includeInNetWorth!==false,
      name: account.name,
      institution: account.institution ?? "",
      isCash: account.kind==="bank" && !account.institution,
      kind: account.kind,
      currency: account.currency,
      currentBalance: String(account.current_balance),
      reportingBalanceIdr: account.reporting_balance_idr === null ? "" : String(account.reporting_balance_idr),
    });
    setFormError(null);
    setFormErrors({});
    setActiveDialog("account");
  }

  function openAccountToggleDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setFormError(null);
    setAccountToToggle(account);
  }

  function openAccountDeleteDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setFormError(null);
    setAccountToDelete(account);
  }

  useEffect(()=>{const view=params.get("view"),id=params.get("id"),key=`${view}:${id}`;if(loading||!view||openedView.current===key)return;openedView.current=key;const timer=window.setTimeout(()=>{if(view==="create")openAccountDialog();else if(view==="transfer")openTransferDialog();else if(view==="detail"){const account=id?accounts.find(item=>item.id===id):accounts[0];if(account)openEditAccountDialog(account);}},0);return()=>window.clearTimeout(timer);},[loading,params,accounts]);

  async function deleteAccount() {
    if (!accountToDelete) return;
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    if (Number(accountToDelete.current_balance) !== 0) {
      setFormError(t("Saldo akun harus nol sebelum dihapus permanen."));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const accountId = accountToDelete.id;
      const linkedResults = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("account_transfers").select("id", { count: "exact", head: true }).eq("user_id", user.id).or(`source_account_id.eq.${accountId},destination_account_id.eq.${accountId}`),
        supabase.from("recurring_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("account_reconciliations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("stock_executions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("forex_trades").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
        supabase.from("account_equity_snapshots").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", accountId),
      ]);
      const linkedError = linkedResults.find((result) => result.error)?.error;
      if (linkedError) throw linkedError;
      if (linkedResults.some((result) => (result.count ?? 0) > 0)) {
        setFormError(t("Akun punya riwayat terhubung dan tidak dapat dihapus. Arsipkan akun sebagai gantinya."));
        return;
      }

      const { error } = await supabase
        .from("financial_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", user.id);
      if (error) throw error;
      setAccountToDelete(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account delete failed", error, "Akun belum berhasil dihapus.");
      setFormError(t("Akun belum berhasil dihapus. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  function openTransferDialog() {
    rememberTrigger();
    setTransferForm(createTransferForm());
    setFormError(null);
    setFormErrors({});
    setActiveDialog("transfer");
  }

  function openBalanceDialog(account: AccountOverviewRecord) {
    rememberTrigger();
    setBalanceAccount(account);
    setBalanceForm({
      currentBalance: String(account.current_balance),
      reportingBalanceIdr: account.reporting_balance_idr === null ? "" : String(account.reporting_balance_idr),
    });
    setFormError(null);
    setFormErrors({});
    setActiveDialog("balance");
  }

  async function refreshForeignBalances() {
    const foreignAccounts = activeAccounts.filter((account) => account.currency !== "IDR");
    if (!foreignAccounts.length || refreshingFx) return;
    if (!canWriteOnline()) {
      setFxRefreshMessage(t(offlineWriteMessage));
      return;
    }

    setRefreshingFx(true);
    setFxRefreshMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const rates = await getIdrRates(foreignAccounts.map((account) => account.currency), { forceRefresh: true });
      setFxRates(rates);
      const updates = await Promise.all(foreignAccounts.map(async (account) => {
        const rate = rates.get(account.currency);
        if (!rate || rate.rate === null) return false;
        const { error } = await supabase
          .from("financial_accounts")
          .update({ reporting_balance_idr: Number(account.current_balance) * rate.rate })
          .eq("id", account.id)
          .eq("user_id", user.id);
        if (error) throw error;
        return true;
      }));
      const updatedCount = updates.filter(Boolean).length;
      const missingCount = foreignAccounts.length - updatedCount;
      setFxRefreshMessage(missingCount
        ? t("Kurs diperbarui untuk {count} akun. {missing} akun mempertahankan nilai manual karena kurs tidak tersedia.", { count: updatedCount, missing: missingCount })
        : t("Kurs IDR terbaru diperbarui untuk {count} akun.", { count: updatedCount }));
      await loadAccounts();
    } catch (error) {
      reportHandledError("FX refresh failed", error, "Kurs IDR belum berhasil diperbarui.");
      setFxRefreshMessage(t("Kurs IDR belum berhasil diperbarui. Nilai manual tetap dipakai."));
    } finally {
      setRefreshingFx(false);
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const submission = {...accountForm,name:accountForm.name.trim()||accountForm.institution.trim()||(accountForm.isCash?"Tunai":"")};
    const validation = validateAccountForm(submission);
    if (!validation.valid) {
      setFormErrors(validation.errors as Record<string, string>);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const reportingBalanceIdr = accountForm.reportingBalanceIdr.trim() ? Number(accountForm.reportingBalanceIdr) : null;
      const identity = { name: submission.name, institution: accountForm.isCash ? null : accountForm.institution.trim() || null };
      const { data: savedAccount, error } = editingAccount
        ? await supabase.from("financial_accounts").update(identity).eq("id", editingAccount.id).eq("user_id", user.id).select("id").single()
        : await supabase.from("financial_accounts").insert({
          user_id: user.id,
          ...identity,
          kind: accountForm.kind,
          currency: accountForm.currency.toUpperCase(),
          current_balance: Number(accountForm.currentBalance),
          reporting_balance_idr: accountForm.currency === "IDR" ? null : reportingBalanceIdr,
        }).select("id").single();
      if (error) throw error;
      if(savedAccount?.id)saveAccountDisplay(user.id,savedAccount.id,{cardColor:accountForm.cardColor??"green",includeInNetWorth:accountForm.includeInNetWorth!==false});
      setActiveDialog(null);
      setEditingAccount(null);
      setAccountForm(emptyAccountForm);
      await loadAccounts();
      window.dispatchEvent(new Event("fintrack:setup-data-saved"));
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account save failed", error, "Akun belum berhasil disimpan.");
      setFormError(t("Akun belum berhasil disimpan. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccountActive() {
    if (!accountToToggle) return;
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error } = await supabase
        .from("financial_accounts")
        .update({ is_active: !accountToToggle.is_active })
        .eq("id", accountToToggle.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setAccountToToggle(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Account lifecycle update failed", error, "Status akun belum berhasil diperbarui.");
      setFormError(t("Status akun belum berhasil diperbarui. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    const validation = validateTransferForm({
      sourceAccountId: transferForm.sourceAccountId,
      destinationAccountId: transferForm.destinationAccountId,
      sourceAmount: transferForm.amount,
      destinationAmount: transferForm.destinationAmount,
      sourceCurrency: sourceAccount?.currency ?? "",
      destinationCurrency: destinationAccount?.currency ?? "",
      date: transferForm.date,
    });
    if (!validation.valid || !sourceAccount || !destinationAccount) {
      setFormErrors(validation.errors as Record<string, string>);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const destinationAmount = isCrossCurrencyTransfer ? Number(transferForm.destinationAmount) : Number(transferForm.amount);
      const { error } = await supabase.from("account_transfers").insert({
        user_id: user.id,
        source_account_id: sourceAccount.id,
        destination_account_id: destinationAccount.id,
        amount: Number(transferForm.amount),
        destination_amount: destinationAmount,
        currency: sourceAccount.currency,
        destination_currency: destinationAccount.currency,
        date: transferForm.date,
        kind: transferForm.kind,
        note: transferForm.note.trim() || null,
      });
      if (error) throw error;
      setActiveDialog(null);
      setTransferForm(createTransferForm());
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Transfer save failed", error, "Transfer belum berhasil disimpan.");
      setFormError(t("Transfer belum berhasil disimpan. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteOnline()) {
      setFormError(t(offlineWriteMessage));
      return;
    }
    if (!balanceAccount) return;
    const reportingBalanceIdr = balanceForm.reportingBalanceIdr.trim() ? Number(balanceForm.reportingBalanceIdr) : null;
    if (balanceAccount.currency !== "IDR" && reportingBalanceIdr !== null && (!Number.isFinite(reportingBalanceIdr) || reportingBalanceIdr < 0)) {
      setFormErrors({ reportingBalanceIdr: "Nilai setara IDR harus nol atau lebih." });
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const { error } = await supabase
        .from("financial_accounts")
        .update({ reporting_balance_idr: balanceAccount.currency === "IDR" ? null : reportingBalanceIdr })
        .eq("id", balanceAccount.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setActiveDialog(null);
      setBalanceAccount(null);
      await loadAccounts();
      window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    } catch (error) {
      reportHandledError("Balance update failed", error, "Saldo belum berhasil diperbarui.");
      setFormError(t("Saldo belum berhasil diperbarui. Coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReferenceRoot page="dompet">
      <Navbar />
      {pageError&&<div role="alert" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-error-container p-3 text-error">{pageError}</div>}{loading?<main className="pt-20 px-margin"><AccountsSkeleton/></main>:!pageError&&<WalletView accounts={accounts} onAdd={openAccountDialog} onTransfer={openTransferDialog} onDetail={openEditAccountDialog}/>}


      {activeDialog === "account" && <AccountEditor form={accountForm} setForm={form=>setAccountForm({...form,cardColor:form.cardColor??"green",includeInNetWorth:form.includeInNetWorth!==false,isCash:form.isCash??false})} editing={Boolean(editingAccount)} account={editingAccount} busy={saving} error={formError??(Object.values(formErrors).join(" ")||null)} onClose={closeDialog} onSave={saveAccount} onDelete={editingAccount?()=>openAccountDeleteDialog(editingAccount):undefined} onTransfer={openTransferDialog} onAdjust={editingAccount?()=>openBalanceDialog(editingAccount):undefined}/>}
      {accountToToggle && (
        <ConfirmDialog
          titleId="account-lifecycle-title"
          descriptionId="account-lifecycle-description"
          title={t(accountToToggle.is_active ? "Arsipkan {name}?" : "Aktifkan kembali {name}?", { name: accountToToggle.name })}
          description={t(accountToToggle.is_active ? "Akun akan disembunyikan dari transaksi, transfer, dan entri baru. Riwayat tetap utuh." : "Akun akan tersedia lagi untuk transaksi, transfer, dan entri baru.")}
          confirmLabel={t(accountToToggle.is_active ? "Arsipkan akun" : "Aktifkan akun")}
          cancelLabel={t("Batal")}
          onClose={() => { if (!saving) setAccountToToggle(null); }}
          onConfirm={() => void toggleAccountActive()}
          loading={saving}
          error={formError}
        />
      )}
      {accountToDelete && (
        <ConfirmDialog
          titleId="account-delete-title"
          descriptionId="account-delete-description"
          title={t("Hapus permanen {name}?", { name: accountToDelete.name })}
          description={t("Tindakan ini tidak dapat dibatalkan. Akun hanya bisa dihapus bila saldo nol dan tidak punya riwayat transaksi, transfer, jadwal, atau jurnal.")}
          confirmLabel={t("Hapus permanen")}
          cancelLabel={t("Batal")}
          onClose={() => { if (!saving) setAccountToDelete(null); }}
          onConfirm={() => void deleteAccount()}
          loading={saving}
          error={formError}
        />
      )}
      {activeDialog === "transfer" && <TransferEditor form={transferForm} setForm={setTransferForm} accounts={activeAccounts} busy={saving} error={formError??(Object.values(formErrors).join(" ")||null)} onSave={saveTransfer} onClose={closeDialog}/>}
      {activeDialog === "balance" && balanceAccount && (
        <BalanceDialog
          account={balanceAccount}
          form={balanceForm}
          setForm={setBalanceForm}
          errors={formErrors}
          error={formError}
          saving={saving}
          balanceInputRef={balanceInputRef}
          onClose={closeDialog}
          onSubmit={saveBalance}
        />
      )}
    </ReferenceRoot>
  );
}

function AccountDialogFrame({ title, eyebrow, description, saving, error, initialFocusRef, onClose, onSubmit, children, submitLabel, submitDisabled = false }: {
  title: string;
  eyebrow: string;
  description: string;
  saving: boolean;
  error: string | null;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  children: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <AccessibleDialogFrame
      titleId="account-dialog-title"
      descriptionId="account-dialog-description"
      initialFocusRef={initialFocusRef}
      onClose={onClose}
      closeDisabled={saving}
    >
      <form onSubmit={onSubmit}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{eyebrow}</p>}
            <h2 id="account-dialog-title" className={cn("text-xl font-bold tracking-tight text-slate-900", eyebrow && "mt-1")}>{title}</h2>
            {description && <p id="account-dialog-description" className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("Tutup {title}", { title: title.toLowerCase() })}><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          {children}
          <div aria-live="polite" aria-atomic="true">{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>}</div>
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:justify-end sm:px-6 sm:pb-4">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">{t("Batal")}</Button>
          <Button type="submit" loading={saving} disabled={submitDisabled} className="flex-[1.4] sm:flex-none">{submitLabel}</Button>
        </div>
      </form>
    </AccessibleDialogFrame>
  );
}

function BalanceDialog({ account, form, setForm, errors, error, saving, balanceInputRef, onClose, onSubmit }: {
  account: AccountOverviewRecord;
  form: BalanceFormState;
  setForm: Dispatch<SetStateAction<BalanceFormState>>;
  errors: Record<string, string>;
  error: string | null;
  saving: boolean;
  balanceInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { t } = useLanguage();
  const reportingBalanceIdr = form.reportingBalanceIdr.trim() ? Number(form.reportingBalanceIdr) : null;
  const validReportingBalance = reportingBalanceIdr === null || (Number.isFinite(reportingBalanceIdr) && reportingBalanceIdr >= 0);
  return (
    <AccountDialogFrame title={t("Perbarui {name}", { name: account.name })} eyebrow={t("Nilai laporan")} description={t("Saldo ledger berubah dari transaksi terkonfirmasi, transfer, atau penyesuaian. Form ini hanya menyimpan nilai setara IDR untuk akun asing.")} saving={saving} error={error} initialFocusRef={balanceInputRef} onClose={onClose} onSubmit={onSubmit} submitLabel={t("Simpan nilai laporan")} submitDisabled={account.currency === "IDR" || !validReportingBalance}>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">{t("Saldo saat ini")}</p>
        <p className="mt-2 font-mono text-xl font-bold text-slate-900">{formatMoney(Number(account.current_balance), account.currency)}</p>
      </div>
      <Field label={t("Saldo ledger ({currency})", { currency: account.currency })} htmlFor="balance-current">
        <input ref={balanceInputRef} id="balance-current" type="number" value={form.currentBalance} readOnly aria-readonly="true" className={cn(fieldControlStyles, "cursor-not-allowed bg-slate-50 font-mono text-base font-bold text-slate-500")} />
      </Field>
      {account.currency === "IDR" && <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{t("Saldo akun IDR diperbarui lewat transaksi terkonfirmasi, transfer, atau penyesuaian rekening.")}</p>}
      {account.currency !== "IDR" && (
        <Field label={t("Nilai setara IDR")} htmlFor="balance-reporting" error={errors.reportingBalanceIdr ? t(errors.reportingBalanceIdr) : undefined} hint={t("Kosongkan jika belum ingin memasukkan akun ini ke total IDR.")}>
          <input id="balance-reporting" type="number" min="0" step="any" inputMode="decimal" value={form.reportingBalanceIdr} onChange={(event) => setForm((current) => ({ ...current, reportingBalanceIdr: event.target.value }))} placeholder="0" className={fieldControlStyles} />
        </Field>
      )}
    </AccountDialogFrame>
  );
}

function AccountsSkeleton() { return <PageSkeleton variant="wallet"/>; }
