"use client";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import { useFinancialRefresh } from "@/components/reference/useFinancialRefresh";

import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { ReportsView } from "@/components/reference/ReportsView";
import { ReferenceRoot } from "@/components/reference/runtime";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { reportHandledError } from "@/lib/errors";
import { getIdrRates,type FxRateResult } from "@/lib/fx";
import { buildCumulativeCashFlowSeries } from "@/lib/home";
import {
buildDeterministicInsight,
buildInsightSnapshot,
buildPrivateInsightPayload,
convertInsightTransactionsToIdr,
type DeterministicInsight,
type InsightAction,
type InsightSnapshot,
type InsightTransaction,
} from "@/lib/insights";
import {
generatedInsightEnvelopeSchema,
type GeneratedInsightEnvelope,
} from "@/lib/insights-api";
import { canWriteOnline,offlineWriteMessage } from "@/lib/pwa";
import { addMonths,endOfMonth,format,getDaysInMonth,parse,startOfMonth } from "date-fns";
import { enUS,id as idLocale } from "date-fns/locale";
import {
Eye
} from "lucide-react";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

type InsightView = Omit<DeterministicInsight, "actions"> & {
  actions: InsightAction[];
  generatedAt?: string;
  model?: string;
};

type InsightAnalytics = {
  cashFlow: ReturnType<typeof buildCumulativeCashFlowSeries>;
};

type Translator = ReturnType<typeof useLanguage>["t"];

function translateInsightText(t: Translator, text: string) {
  const categoryTitle = /^Tinjau kategori (.+)$/.exec(text);
  if (categoryTitle) return t("Tinjau kategori {category}", { category: t(categoryTitle[1]) });
  const pending = /^(\d+) transaksi (belum masuk ke perhitungan terverifikasi|masih menunggu peninjauan)\.$/.exec(text);
  if (pending) return t(pending[2] === "masih menunggu peninjauan" ? "{count} transaksi masih menunggu peninjauan." : "{count} transaksi belum masuk ke perhitungan terverifikasi.", { count: pending[1] });
  const account = /^(\d+) akun belum memiliki nilai pelaporan IDR\.$/.exec(text);
  if (account) return t("{count} akun belum memiliki nilai pelaporan IDR.", { count: account[1] });
  const categoryShare = /^(.+) mencakup (.+)% dari pengeluaran\.$/.exec(text);
  if (categoryShare) return t("{category} mencakup {share}% dari pengeluaran.", { category: t(categoryShare[1]), share: categoryShare[2] });
  const expenseChange = /^Pengeluaran (naik|turun) (.+)% dibanding (.+)\.$/.exec(text);
  if (expenseChange) return t("Pengeluaran {direction} {change}% dibanding {period}.", { direction: t(expenseChange[1]), change: expenseChange[2], period: expenseChange[3] });
  return t(text);
}

const CATEGORY_COLORS = ["#087f45", "#21975b", "#48ae75", "#78c596", "#a2d8b6"];
const DARK_CATEGORY_COLORS = ["#0954cf", "#3974d9", "#6796e3", "#91b3ed", "#bbd0f5"];

function formatMoney(value: number, language = "id") {
  return new Intl.NumberFormat(language === "en" ? "en-ID" : "id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number, currency: string, language = "id") {
  const locale = language === "en" ? "en-ID" : "id-ID";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(locale)}`;
  }
}

function monthBounds(monthValue: string, dateLocale: typeof enUS | typeof idLocale) {
  const selected = parse(monthValue, "yyyy-MM", new Date(2000, 0, 1));
  const previous = addMonths(selected, -1);
  return {
    selected,
    currentStart: format(startOfMonth(selected), "yyyy-MM-dd"),
    currentEnd: format(endOfMonth(selected), "yyyy-MM-dd"),
    previousStart: format(startOfMonth(previous), "yyyy-MM-dd"),
    previousEnd: format(endOfMonth(previous), "yyyy-MM-dd"),
    periodLabel: format(selected, "MMMM yyyy", { locale: dateLocale }),
    previousPeriodLabel: format(previous, "MMMM yyyy", { locale: dateLocale }),
  };
}

export default function InsightsPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === "en" ? enUS : idLocale;
  const [month, setMonth] = useState("");
  const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null);
  const [insight, setInsight] = useState<InsightView | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null);
  const [incomeCategories, setIncomeCategories] = useState<Array<{name:string;amount:number;share:number}>>([]);
  const [analytics, setAnalytics] = useState<InsightAnalytics | null>(null);
  const [fxRates, setFxRates] = useState<ReadonlyMap<string, FxRateResult>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const forceFxRefreshRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMonth(format(new Date(), "yyyy-MM")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadInsights = useCallback(async () => {
    if (!month) return;
    void refreshKey;
    const forceFxRefresh = forceFxRefreshRef.current;
    forceFxRefreshRef.current = false;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingData(true);
    setLoadingAi(false);
    setDataError(null);
    setAiError(null);

    let calculatedSnapshot: InsightSnapshot | null = null;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw sessionError ?? new Error("Sesi login tidak ditemukan.");
      const bounds = monthBounds(month, dateLocale);
      const [currentResult, previousResult, accountsResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, date, type, category, amount, status, account_id")
          .eq("user_id", session.user.id)
          .gte("date", bounds.currentStart)
          .lte("date", bounds.currentEnd),
        supabase
          .from("transactions")
          .select("id, date, type, category, amount, status, account_id")
          .eq("user_id", session.user.id)
          .gte("date", bounds.previousStart)
          .lte("date", bounds.previousEnd),
        supabase
          .from("financial_accounts")
          .select("id, currency, reporting_balance_idr, is_active")
          .eq("user_id", session.user.id)
          .eq("is_active", true),
      ]);
      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;
      if (accountsResult.error) throw accountsResult.error;
      if (controller.signal.aborted) return;

      const accounts = accountsResult.data ?? [];
      const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]));
      const allTransactions = [...currentResult.data ?? [], ...previousResult.data ?? []] as InsightTransaction[];
      const transactionCurrencies = allTransactions.flatMap((transaction) => {
        const currency = transaction.account_id ? accountCurrencies.get(transaction.account_id) : null;
        return currency ? [currency] : [];
      });
      const rates = await getIdrRates(transactionCurrencies, { allowStale: true, forceRefresh: forceFxRefresh });
      if (controller.signal.aborted) return;
      const rateValues = new Map([...rates].flatMap(([currency, rate]) => rate.rate === null ? [] : [[currency, rate.rate] as const]));
      const currentTransactions = (currentResult.data ?? []) as InsightTransaction[];
      const nextSnapshot = buildInsightSnapshot({
        current: currentTransactions,
        previous: (previousResult.data ?? []) as InsightTransaction[],
        periodLabel: bounds.periodLabel,
        previousPeriodLabel: bounds.previousPeriodLabel,
        activeAccountCount: accounts.length,
        uncoveredForeignAccountCount: accounts.filter((account) => account.currency !== "IDR" && account.reporting_balance_idr === null).length,
        accountCurrencies,
        rates: rateValues,
      });
      calculatedSnapshot = nextSnapshot;
      const fallback = buildDeterministicInsight(nextSnapshot);
      const convertedCurrent = nextSnapshot.fxState === "converted"
        ? convertInsightTransactionsToIdr(currentTransactions, accountCurrencies, rateValues)
        : [];
      const daysInMonth = getDaysInMonth(bounds.selected);
      const sampleDays = [...new Set([1, 7, 13, 19, 25, daysInMonth])].filter((day) => day <= daysInMonth);
      const budgetResult = await supabase.from("financial_budgets").select("limit_amount").eq("user_id",session.user.id).eq("month",bounds.currentStart).abortSignal(controller.signal);
      setBudgetTotal(budgetResult.error || !budgetResult.data?.length ? null : (budgetResult.data??[]).reduce((sum,item)=>sum+Number(item.limit_amount),0));
      const incomeTotals = new Map<string,number>();
      convertedCurrent.filter(tx=>tx.type==="income"&&tx.status==="confirmed").forEach(tx=>incomeTotals.set(tx.category,(incomeTotals.get(tx.category)??0)+Number(tx.amount)));
      setIncomeCategories([...incomeTotals].map(([name,amount])=>({name,amount,share:nextSnapshot.current.income>0?Math.round(amount/nextSnapshot.current.income*1000)/10:0})).sort((left,right)=>right.amount-left.amount));
      setSnapshot(nextSnapshot);
      setFxRates(rates);
      setAnalytics(nextSnapshot.fxState === "converted" ? {
        cashFlow: buildCumulativeCashFlowSeries(
          convertedCurrent
            .filter((transaction) => transaction.status === "confirmed")
            .map(({ date, type, amount }) => ({ date, type, amount: Number(amount) })),
          sampleDays,
          format(bounds.selected, "MMM", { locale: dateLocale }),
        ),
      } : null);
      setInsight(fallback);
      setLoadingData(false);

      if (nextSnapshot.current.confirmedCount === 0) return;
      if (nextSnapshot.fxState !== "converted") {
        setAiError(t("Kurs IDR belum tersedia untuk semua transaksi. Insight tetap dipisahkan per mata uang dan tidak dikirim ke AI."));
        return;
      }
      if (!canWriteOnline()) {
        setAiError(offlineWriteMessage);
        return;
      }
      const payload = buildPrivateInsightPayload(nextSnapshot);
      if (!payload) return;
      setLoadingAi(true);
      const response = await fetch("/api/insights/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({...payload,language}),
        cache: "no-store",
        signal: controller.signal,
      });
      const responseBody = await response.json().catch(() => ({})) as { insight?: unknown; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setAiError(responseBody.error || t("AI belum bisa menyusun insight. Analisis lokal tetap tersedia."));
        return;
      }
      const parsedInsight = generatedInsightEnvelopeSchema.safeParse(responseBody.insight);
      if (!parsedInsight.success) throw new Error("Respons AI tidak valid.");
      const generated = parsedInsight.data;
      setInsight(mapGeneratedInsight(generated, fallback.actions));
    } catch (loadError) {
      if (controller.signal.aborted) return;
      reportHandledError("Smart insights unavailable", loadError, "Insight belum berhasil dimuat.");
      if (calculatedSnapshot) setAiError(t("AI belum bisa menyusun insight. Analisis lokal tetap tersedia."));
      else setDataError(t("Data untuk Smart Insights belum berhasil dimuat. Coba lagi."));
    } finally {
      if (!controller.signal.aborted) {
        setLoadingData(false);
        setLoadingAi(false);
      }
    }
  }, [month, refreshKey, dateLocale, t, language]);

  useFinancialRefresh(loadInsights);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadInsights(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadInsights]);

  const displayInsight = useMemo(() => insight ?? (snapshot ? buildDeterministicInsight(snapshot) : null), [insight, snapshot]);
  const refreshInsights = (forceFxRefresh = false) => {
    forceFxRefreshRef.current = forceFxRefresh;
    setRefreshKey((value) => value + 1);
  };

  return <ReferenceRoot page="laporan"><Navbar/>{dataError&&<p role="alert" className="fixed top-16 inset-x-5 z-40 rounded-2xl bg-error-container p-3 text-error">{dataError}<button onClick={()=>refreshInsights(true)} className="ml-2 underline">{t("Coba lagi")}</button></p>}{loadingData||!month?<main className="pt-20 px-margin" aria-busy="true"><InsightsSkeleton/></main>:snapshot?<ReportsView snapshot={snapshot} month={month} setMonth={setMonth} budget={budgetTotal} incomeCategories={incomeCategories} observations={displayInsight?.observations??[]} generated={Boolean(insight && "generatedAt" in insight && insight.generatedAt)}/>:null}</ReferenceRoot>;
}

function mapGeneratedInsight(generated: GeneratedInsightEnvelope, candidates: InsightAction[]): InsightView {
  const candidateById = new Map(candidates.map((action) => [action.id, action]));
  return {
    headline: generated.headline,
    summary: generated.summary,
    tone: generated.tone,
    actions: generated.actions.flatMap((action) => {
      const candidate = candidateById.get(action.candidateId);
      return candidate ? [{ ...candidate, title: action.title, reason: action.reason, impact: action.impact }] : [];
    }),
    observations: generated.observations,
    generatedAt: generated.generatedAt,
    model: generated.model,
  };
}

function InsightsSkeleton() { return <PageSkeleton variant="insights"/>; }
