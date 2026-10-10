"use client";
import {DialogFrame} from "@/components/ui/DialogFrame";
import {PageSkeleton} from "@/components/ui/PageSkeleton";
import { useSearchParams } from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { GoalDetail,GoalEditor } from "@/components/reference/GoalEditors";
import { GoalsView } from "@/components/reference/GoalsView";
import { ReferenceRoot } from "@/components/reference/runtime";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { reportHandledError } from "@/lib/errors";
import { useCallback,useEffect,useRef,useState,type FormEvent } from "react";

type FinancialGoal = { id: string; name: string; target_amount: number; current_amount: number; currency: string; color: string | null; due_date: string | null; is_active: boolean };
type GoalForm = { name: string; targetAmount: string; currentAmount: string; currency: string; dueDate: string };

const emptyForm: GoalForm = { name: "", targetAmount: "", currentAmount: "0", currency: "IDR", dueDate: "" };

export default function GoalsPage() {
  const { t } = useLanguage();
  const params=useSearchParams();
  const openedView=useRef<string|null>(null);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickGoal,setQuickGoal]=useState<FinancialGoal|null>(null);
  const [quickAmount,setQuickAmount]=useState("");
  const [sourceId,setSourceId]=useState("");
  const [sources,setSources]=useState<Array<{id:string;name:string;currency:string;current_balance:number}>>([]);
  const [detailGoal,setDetailGoal]=useState<FinancialGoal|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<GoalForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const depositLock=useRef(false);const depositRequest=useRef<{signature:string;id:string}|null>(null);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { if (requestId === requestRef.current) setGoals([]); return; }
      const { data, error: goalsError } = await supabase.from("financial_goals").select("id,name,target_amount,current_amount,currency,color,due_date,is_active").eq("user_id", user.id).order("due_date", { ascending: true, nullsFirst: false });
      if (goalsError) throw goalsError;
      const {data:accountData,error:accountError}=await supabase.from("financial_accounts").select("id,name,currency,current_balance").eq("user_id",user.id).eq("is_active",true).neq("kind","liability");if(accountError)throw accountError;
      if (requestId === requestRef.current){setGoals((data ?? []) as FinancialGoal[]);setSources(accountData??[]);}
    } catch (caught) {
      if (requestId === requestRef.current) { reportHandledError("Goals unavailable", caught, "Goals belum berhasil dimuat."); setError(t("Goals belum berhasil dimuat. Coba lagi.")); }
    } finally { if (requestId === requestRef.current) setLoading(false); }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); requestRef.current += 1; }; }, [load]);

  useEffect(()=>{const view=params.get("view"),id=params.get("id"),key=`${view}:${id}`;if(loading||!view||openedView.current===key)return;openedView.current=key;const timer=window.setTimeout(()=>{if(view==="create"){setEditingId(null);setForm(emptyForm);setSheetOpen(true);}else if(view==="detail"){const goal=id?goals.find(item=>item.id===id):goals[0];if(goal)setDetailGoal(goal);}},0);return()=>window.clearTimeout(timer);},[loading,params,goals]);
  const openSheet = () => { setEditingId(null);setForm(emptyForm); setSheetOpen(true); };
  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    const targetAmount = Number(form.targetAmount); const currentAmount = Number(form.currentAmount);
    if (!form.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0 || !/^[A-Z]{3}$/.test(form.currency)) return;
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const payload={user_id:user.id,name:form.name.trim(),target_amount:targetAmount,current_amount:currentAmount,currency:form.currency,due_date:form.dueDate||null};
      const {error:insertError}=editingId?await supabase.from("financial_goals").update(payload).eq("id",editingId).eq("user_id",user.id):await supabase.from("financial_goals").insert(payload);
      if (insertError) throw insertError;
      setSheetOpen(false); await load();
    } catch (caught) { reportHandledError("Goal save failed", caught, "Target belum tersimpan."); setError(t("Target belum tersimpan. Coba lagi.")); }
    finally { setSaving(false); }
  }

  async function depositGoal(goal:FinancialGoal,amount:number,accountId:string):Promise<boolean>{
    if(depositLock.current||saving||!Number.isFinite(amount)||amount<=0||!goal.is_active)return false;
    depositLock.current=true;setSaving(true);setError(null);
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error("Session unavailable");
      const signature=`${goal.id}:${accountId}:${amount}`;if(depositRequest.current?.signature!==signature)depositRequest.current={signature,id:crypto.randomUUID()};
      const {data,error:updateError}=await supabase.rpc("deposit_to_financial_goal",{p_request_id:depositRequest.current.id,p_goal_id:goal.id,p_account_id:accountId,p_amount:amount});
      if(updateError||!data)throw updateError??new Error("Goal changed");
      depositRequest.current=null;setDetailGoal(current=>current?.id===goal.id?data as FinancialGoal:current);setGoals(current=>current.map(item=>item.id===goal.id?data as FinancialGoal:item));setSources(current=>current.map(item=>item.id===accountId?{...item,current_balance:Number(item.current_balance)-amount}:item));return true;
    }catch(caught){reportHandledError("Goal deposit failed",caught,"Setoran belum tersimpan.");setError(t("Setoran belum tersimpan. Coba lagi."));return false;}finally{depositLock.current=false;setSaving(false);}
  }

  async function archiveGoal(goal: FinancialGoal) {
    setArchivingId(goal.id);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Session unavailable");
      const { error: updateError } = await supabase.from("financial_goals").update({ is_active: false }).eq("id", goal.id).eq("user_id", user.id);
      if (updateError) throw updateError;
      await load();
    } catch (caught) { reportHandledError("Goal archive failed", caught, "Target belum dapat diarsipkan."); setError(t("Target belum dapat diarsipkan. Coba lagi.")); }
    finally { setArchivingId(null); }
  }

  return <ReferenceRoot page="target"><Navbar/>{loading?<main className="pt-20 px-margin" aria-busy="true"><PageSkeleton variant="goals"/></main>:<GoalsView goals={goals} onQuickSave={goal=>{setQuickGoal(goals.find(item=>item.id===goal.id)??null);setQuickAmount("");setSourceId("");setError(null);}} onAdd={openSheet} onDetail={goal=>setDetailGoal(goals.find(item=>item.id===goal.id)??null)}/>}{error&&<p role="alert" className="px-margin text-error">{error}</p>}
{quickGoal&&<DialogFrame titleId="quick-goal-title" onClose={()=>!saving&&setQuickGoal(null)} closeDisabled={saving}><form className="p-5 flex flex-col gap-4" onSubmit={async event=>{event.preventDefault();if(await depositGoal(quickGoal,Number(quickAmount),sourceId))setQuickGoal(null);}}><div><h2 id="quick-goal-title" className="text-headline-sm font-bold">{t("Nabung Cepat")}</h2><p className="mt-1 text-body-sm text-on-surface-variant">{quickGoal.name}</p></div><label className="text-body-sm">{t("Nominal Setoran")}<div className="quick-goal-amount mt-2 flex gap-3 items-center rounded-2xl bg-surface-container-low p-3"><span className="text-on-surface-variant">{quickGoal.currency==="IDR"?"Rp":quickGoal.currency}</span><input placeholder="0" autoFocus inputMode="decimal" required disabled={saving} value={quickAmount} onChange={event=>setQuickAmount(event.target.value)} type="number" min="0.01" step="any" className="w-full bg-transparent text-on-surface outline-none"/></div></label><label className="text-body-sm">{t("Rekening Sumber")}<select required disabled={saving} value={sourceId} onChange={event=>setSourceId(event.target.value)} className="mt-2 w-full rounded-2xl bg-surface-container p-3"><option value="">{t("Pilih akun")}</option>{sources.filter(item=>item.currency===quickGoal.currency).map(item=><option key={item.id} value={item.id}>{item.name} · {new Intl.NumberFormat("id-ID",{style:"currency",currency:item.currency}).format(item.current_balance)}</option>)}</select></label><p className="text-body-sm text-on-surface-variant">{t("Setoran mengurangi saldo rekening sumber.")}</p>{error&&<p role="alert" className="text-error">{error}</p>}<div className="flex gap-3"><button type="button" disabled={saving} onClick={()=>setQuickGoal(null)} className="flex-1 rounded-full bg-surface-container py-3">{t("Batal")}</button><button type="submit" disabled={saving||Number(quickAmount)<=0||!sourceId} className="flex-1 rounded-full bg-primary-container py-3 disabled:opacity-50" style={{color:"#fff"}}>{t(saving?"Menyimpan...":"Konfirmasi Setoran")}</button></div></form></DialogFrame>}
{sheetOpen&&<GoalEditor form={form} setForm={setForm} busy={saving} error={error} onSave={saveGoal} onClose={()=>!saving&&setSheetOpen(false)}/>}{detailGoal&&<GoalDetail goal={detailGoal} busy={saving} error={error} sources={sources} onDeposit={(amount,accountId)=>depositGoal(detailGoal,amount,accountId)} onClose={()=>setDetailGoal(null)} onEdit={()=>{setEditingId(detailGoal.id);setForm({name:detailGoal.name,targetAmount:String(detailGoal.target_amount),currentAmount:String(detailGoal.current_amount),currency:detailGoal.currency,dueDate:detailGoal.due_date??""});setDetailGoal(null);setSheetOpen(true);}} onArchive={()=>{void archiveGoal(detailGoal);setDetailGoal(null);}}/>}</ReferenceRoot>;
}
