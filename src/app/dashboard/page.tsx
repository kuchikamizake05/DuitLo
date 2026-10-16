"use client";
import { fetchAllRows } from "@/lib/paginated-query";
import {getNumberFormatter} from "@/lib/intl";

import {PageSkeleton} from "@/components/ui/PageSkeleton";
import { useFinancialRefresh } from "@/components/reference/useFinancialRefresh";

import { useFinancialJourney } from "@/components/FinancialJourney";
import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { useOnboarding } from "@/components/OnboardingBoundary";
import { DashboardView } from "@/components/reference/DashboardView";
import { ReferenceRoot } from "@/components/reference/runtime";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { calculatePercentageChange } from "@/lib/analytics";
import { reportHandledError } from "@/lib/errors";
import { groupTransactionAmountsByCurrency } from "@/lib/finance";
import {
buildCumulativeCashFlowSeries,
maskAmount
} from "@/lib/home";
import type { FinancialAccountKind } from "@/lib/ledger";
import { shouldShowOnboardingResume } from "@/lib/onboarding";
import { endOfMonth,format,getDaysInMonth,parseISO,startOfMonth } from "date-fns";
import { enUS,id } from "date-fns/locale";
import {
Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useState } from "react";

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
  ai_confidence: number | null;
  status: "confirmed" | "pending_approval" | "needs_review" | "deleted";
  account_id: string | null;
  created_at: string;
};

type FinancialAccount = {
  id: string;
  name: string;
  institution: string | null;
  kind: FinancialAccountKind;
  currency: string;
  current_balance: number;
  reporting_balance_idr: number | null;
  is_active: boolean;
  updated_at: string;
};

type FinancialGoal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  color: string | null;
  due_date: string | null;
};

type FinancialBudget = {
  id: string;
  category: string;
  month: string;
  limit_amount: number;
};

function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Koneksi terlalu lama. Silakan coba lagi.")), milliseconds);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default function DashboardPage() {
  const journey = useFinancialJourney();
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : id;
  const router = useRouter();
  const onboarding = useOnboarding(false);
  const onboardingEligibility = onboarding?.eligibility;
  const onboardingProgress = onboarding?.progress;
  const saveProgress = onboarding?.saveProgress;
  const [today] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [budgets, setBudgets] = useState<FinancialBudget[]>([]);
  const [firstName, setFirstName] = useState("Kamu");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState<Array<Pick<Transaction, "amount" | "account_id">>>([]);
  const [showBalances, setShowBalances] = useState(true);
  const [setupCardDismissed, setSetupCardDismissed] = useState(false);

  const setupDismissKey = onboardingProgress?.deferredUntil
    ? `fintrack:onboarding-resume-hidden:${onboardingProgress.userId}:${onboardingProgress.deferredUntil}`
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowBalances(window.localStorage.getItem("fintrack-show-balances") !== "false");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!setupDismissKey) return;
    const timer = window.setTimeout(() => {
      setSetupCardDismissed(window.localStorage.getItem(setupDismissKey) === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setupDismissKey]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      await withTimeout((async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;
        const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Kamu";
        setFirstName(String(displayName).split(" ")[0]);

        const start = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
        const end = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
        const previousMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);

        const [txResult, previousResult, pendingResult, accountResult, goalResult, budgetResult] = await Promise.all([
          fetchAllRows((from, to) => supabase
            .from("transactions")
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .neq("status", "deleted")
            .neq("status", "pending_approval")
            .neq("status", "needs_review")
            .gte("date", start)
            .lte("date", end)
            .order("date", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)),
          fetchAllRows((from, to) => supabase
            .from("transactions")
            .select("id, amount, account_id", { count: "exact" })
            .eq("user_id", user.id)
            .eq("type", "expense")
            .neq("status", "deleted")
            .neq("status", "pending_approval")
            .neq("status", "needs_review")
            .gte("date", format(startOfMonth(previousMonth), "yyyy-MM-dd"))
            .lte("date", format(endOfMonth(previousMonth), "yyyy-MM-dd"))
            .order("date", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)),
          fetchAllRows((from, to) => supabase
            .from("transactions")
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .in("status", ["pending_approval", "needs_review"])
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)),
          supabase
            .from("financial_accounts")
            .select("id, name, institution, kind, currency, current_balance, reporting_balance_idr, is_active, updated_at")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("financial_goals")
            .select("id, name, target_amount, current_amount, currency, color, due_date")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("financial_budgets")
            .select("id, category, month, limit_amount")
            .eq("user_id", user.id)
            .eq("month", start)
            .order("category"),
        ]);

        if (txResult.error) throw txResult.error;
        if (previousResult.error) throw previousResult.error;
        if (pendingResult.error) throw pendingResult.error;
        if (accountResult.error) throw accountResult.error;

        setTransactions((txResult.data || []) as Transaction[]);
        setPreviousMonthExpenses((previousResult.data || []) as Array<Pick<Transaction, "amount" | "account_id">>);
        setPendingTx((pendingResult.data || []) as Transaction[]);
        setAccounts((accountResult.data || []) as FinancialAccount[]);

        if (goalResult.error) {
          if (goalResult.error.code !== "42P01" && goalResult.error.code !== "PGRST205") throw goalResult.error;
          setGoals([]);
        } else {
          setGoals((goalResult.data || []) as FinancialGoal[]);
        }

        if (budgetResult.error) {
          if (budgetResult.error.code !== "42P01" && budgetResult.error.code !== "PGRST205") throw budgetResult.error;
          setBudgets([]);
        } else {
          setBudgets((budgetResult.data || []) as FinancialBudget[]);
        }
      })(), 12_000);
    } catch (error) {
      const normalizedError = reportHandledError("Dashboard data unavailable", error, "Data dashboard belum bisa dimuat.");
      setLoadError(normalizedError.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useFinancialRefresh(fetchDashboardData);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboardData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboardData]);

  const adjustMonth = (amount: number) => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const toggleBalances = () => {
    const next = !showBalances;
    setShowBalances(next);
    try { window.localStorage.setItem("fintrack-show-balances", String(next)); } catch {
      // The visibility toggle still works when browser storage is unavailable.
    }
  };

  const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const transactionCurrencies = new Set(transactions.map((transaction) => transaction.account_id ? accountCurrencies.get(transaction.account_id) ?? "Tidak diketahui" : "Tidak diketahui"));
  const cashFlowCurrency = transactionCurrencies.size === 1 && !transactionCurrencies.has("Tidak diketahui") ? [...transactionCurrencies][0] : null;
  const cashFlowTransactions = cashFlowCurrency
    ? transactions.filter((transaction) => transaction.account_id && accountCurrencies.get(transaction.account_id) === cashFlowCurrency)
    : [];
  const totalIncome = cashFlowTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalExpense = cashFlowTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const balance = totalIncome - totalExpense;
  const previousMonthExpense = cashFlowCurrency
    ? previousMonthExpenses
      .filter((transaction) => transaction.account_id && accountCurrencies.get(transaction.account_id) === cashFlowCurrency)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    : 0;
  const expenseChange = cashFlowCurrency ? calculatePercentageChange(totalExpense, previousMonthExpense) : null;
  const daysInMonth = getDaysInMonth(selectedMonth);
  const sampleDays = [...new Set([1, 7, 13, 19, 25, daysInMonth])].filter((day) => day <= daysInMonth);
  const cashFlowData = buildCumulativeCashFlowSeries(
    cashFlowTransactions.map(({ date, type, amount }) => ({ date, type, amount: Number(amount) })),
    sampleDays,
    format(selectedMonth, "MMM", { locale: id }),
  );
  const formatCurrency = (amount: number, currency?: string | null) => {
    const code = currency ?? "IDR";
    return getNumberFormatter(language === "en" ? "en-US" : "id-ID", { style: "currency", currency: code, maximumFractionDigits: code === "IDR" ? 0 : 2 }).format(Math.abs(amount));
  };
  const displayCurrency = (amount: number, currency?: string | null) => maskAmount(formatCurrency(amount, currency), showBalances);
  const pendingByCurrency = groupTransactionAmountsByCurrency(pendingTx, accountCurrencies, ["pending_approval", "needs_review"]);
  const pendingTotals = Object.entries(pendingByCurrency);
  const cashFlowUnavailable = transactions.length > 0 && !cashFlowCurrency;
  const primaryGoal = goals[0];
  const attentionAccount = accounts.find((account) =>
    (account.institution || account.name).toLowerCase().includes("gopay"),
  ) || accounts.find((account) => account.kind === "ewallet") || accounts[0];
  const recentTransactions = transactions.slice(0, 5);
  const idrExpenses = transactions.filter((transaction) => transaction.type === "expense" && transaction.account_id && accountCurrencies.get(transaction.account_id) === "IDR");
  const spendingByCategory = new Map<string, number>();
  idrExpenses.forEach((transaction) => {
    spendingByCategory.set(transaction.category, (spendingByCategory.get(transaction.category) ?? 0) + Number(transaction.amount));
  });
  const budgetProgress = budgets.map((budget) => ({
    ...budget,
    spent: spendingByCategory.get(budget.category) ?? 0,
  })).sort((left, right) => right.spent - left.spent).slice(0, 4);

  const dailyAmounts = new Map<number, number>();
  idrExpenses.forEach((transaction) => {
    const day = parseISO(transaction.date).getDate();
    dailyAmounts.set(day, (dailyAmounts.get(day) ?? 0) + Number(transaction.amount));
  });
  const showSetupCard = onboardingEligibility !== undefined && shouldShowOnboardingResume({
    eligibility: onboardingEligibility,
    hasConfirmedTransaction: transactions.length > 0,
    dismissed: setupCardDismissed,
  });
  const completedSetupDataSteps = Number(Boolean(onboardingProgress?.accountId)) + Number(Boolean(onboardingProgress?.transactionId));

  const resumeSetup = () => {
    if (!onboardingProgress || !saveProgress) return;
    saveProgress({ ...onboardingProgress, deferredUntil: null });
    router.push("/onboarding");
  };

  const dismissSetupCard = () => {
    if (setupDismissKey) window.localStorage.setItem(setupDismissKey, "true");
    setSetupCardDismissed(true);
  };

  return <ReferenceRoot page="beranda"><Navbar/>{loadError && <div role="alert" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-error-container p-3 text-error">{loadError}<button onClick={()=>void fetchDashboardData()} className="ml-2 underline">{t("Coba lagi")}</button></div>}{loading ? <main className="pt-20 px-margin" aria-busy="true"><MobileDashboardSkeleton/></main> : !loadError && <DashboardView firstName={firstName} month={selectedMonth} setMonth={setSelectedMonth} accounts={accounts} transactions={transactions} budgets={budgetProgress} goal={goals[0]} income={totalIncome} expense={totalExpense} currency={cashFlowCurrency} visible={showBalances} toggleVisible={toggleBalances} journey={journey}/>}{!loading&&!loadError&&accounts.length>0&&showSetupCard&&<section role="region" aria-label={t("Selesaikan penyiapan FinTrack")} className="mx-margin mb-24 rounded-3xl bg-surface-container-low p-5"><h2 className="text-headline-sm font-semibold">{t("Selesaikan penyiapan FinTrack")}</h2><p className="mt-2 text-body-sm text-on-surface-variant">{completedSetupDataSteps}/2</p><div className="mt-4 flex gap-3"><button type="button" onClick={resumeSetup} className="rounded-full bg-primary-container px-4 py-2 text-on-primary">{t("Lanjutkan penyiapan")}</button><button type="button" onClick={dismissSetupCard} className="rounded-full bg-surface-container px-4 py-2">{t("Tutup")}</button></div></section>}</ReferenceRoot>;
}

function MobileDashboardSkeleton() { return <PageSkeleton variant="dashboard"/>; }
