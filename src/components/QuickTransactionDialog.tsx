"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {createTransactionOnce} from "@/lib/transaction-write";
import {beginTransactionAttempt,finishTransactionAttempt,readTransactionAttempt} from "@/lib/transaction-attempt";
import { TransactionResult } from "@/components/reference/TransactionFeedback";
import { TransactionEditor } from "@/components/reference/TransactionEditor";
import { useLanguage } from "@/components/LanguageProvider";
import { formatLocalDate } from "@/lib/planning";
import { supabase } from "@/infrastructure/supabase/browser-client";

type Account = { id: string; name: string; currency: string; current_balance?: number; institution?: string };
type Category = { name: string; type: "income" | "expense" };
type QuickTransactionForm = { type: "income" | "expense"; merchant: string; amount: string; accountId: string; category: string; date: string; note: string };

function initialForm(): QuickTransactionForm {
  return { type: "expense", merchant: "", amount: "", accountId: "", category: "", date: formatLocalDate(new Date()), note:"" };
}

export function QuickTransactionDialog({ onClose,initialText="" }: { onClose: () => void;initialText?:string }) {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(()=>({...initialForm(),note:initialText}));
  const [resultOpen,setResultOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveLock=useRef(false);
  const draftId=useRef<string|null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesi login tidak ditemukan.");
        const [accountResult, categoryResult] = await Promise.all([
          supabase.from("financial_accounts").select("id,name,currency,current_balance,institution").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: true }),
          supabase.from("categories").select("name,type").order("name", { ascending: true }),
        ]);
        if (accountResult.error) throw accountResult.error;
        if (categoryResult.error) throw categoryResult.error;
        if (!active) return;
        const nextAccounts = (accountResult.data ?? []) as Account[];
        setAccounts(nextAccounts);
        setCategories((categoryResult.data ?? []) as Category[]);
        const pending=readTransactionAttempt(localStorage,user.id,"manual");
        if(pending){const p=pending.payload;setForm({date:p.date,type:p.type as "income"|"expense",merchant:p.merchant??"",note:p.note??"",category:p.category,amount:String(p.amount),accountId:p.account_id});}
        else setForm((current) => current.accountId || !nextAccounts[0] ? current : { ...current, accountId: nextAccounts[0].id });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t("Form transaksi belum dapat dimuat."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [t]);

  const categoryOptions = useMemo(() => [...new Set(categories.filter((category) => category.type === form.type).map((category) => category.name))], [categories, form.type]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(loading || saving || saveLock.current)return;
    if (!form.accountId || !form.category.trim() || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setError(t("Lengkapi akun, nominal, dan kategori terlebih dahulu."));
      return;
    }
    if (!form.note.trim()) { setError(t("Keterangan transaksi wajib diisi.")); return; }
    saveLock.current=true;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const attempt=beginTransactionAttempt(localStorage,"manual",{
        user_id: user.id,
        date: form.date,
        type: form.type,
        merchant: form.merchant.trim() || null,
        note:form.note.trim() || null,
        category: form.category.trim(),
        amount: Number(form.amount),
        account_id: form.accountId,
        source: "manual",
        status: "confirmed",
      });
      draftId.current=attempt.id;
      await createTransactionOnce(supabase,attempt.id,attempt.payload);
      finishTransactionAttempt(localStorage,user.id,"manual",attempt.id);
      window.dispatchEvent(new Event("fintrack:setup-data-saved"));
      setResultOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Transaksi belum berhasil disimpan. Coba lagi."));
    } finally {
      saveLock.current=false;
      setSaving(false);
    }
  };

  if(resultOpen) return <TransactionResult form={form} accountName={accounts.find(account=>account.id===form.accountId)?.name??"—"} currency={accounts.find(account=>account.id===form.accountId)?.currency??"IDR"} onClose={()=>{window.dispatchEvent(new Event("fintrack:data-changed"));onClose();}} onAdd={()=>{draftId.current=null;setResultOpen(false);setForm({...initialForm(),accountId:form.accountId});}}/>;
  return <TransactionEditor form={form} onChange={setForm} accounts={accounts} categories={categoryOptions} busy={saving} loading={loading} error={error} onClose={onClose} onSave={submit}/>;
}
