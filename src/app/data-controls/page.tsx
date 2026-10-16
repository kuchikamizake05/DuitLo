"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlStyles } from "@/components/ui/Field";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { validateDataControlRequest, submitDataControlRequest, type DataControlKind, type DataControlRequest } from "@/lib/data-control";

const labels: Record<DataControlKind, string> = { support: "Support", export_data: "Data export", correction: "Data correction", delete_account: "Account deletion" };
export default function DataControlsPage() {
  const [requests, setRequests] = useState<DataControlRequest[]>([]);
  const [kind, setKind] = useState<DataControlKind>("support");
  const [details, setDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<{ id: string; kind: DataControlKind; details: string } | null>(null);
  const lock = useRef(false);
  const pending = useRef<{ id: string; kind: DataControlKind; details: string } | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sign in again to manage requests.");
      const { data, error } = await supabase.from("data_control_requests").select("id,kind,details,status,created_at,outcome").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error("Requests are unavailable. Try again later.");
      if (active) {
        setOwner(user.id); setRequests((data ?? []) as DataControlRequest[]);
        try {
          const saved = JSON.parse(localStorage.getItem(`fintrack:data-request:v1:${user.id}`) ?? "null");
          if (saved && typeof saved.id === "string" && typeof saved.details === "string" && labels[saved.kind as DataControlKind]) {
            pending.current = saved; setRecovery(saved); setKind(saved.kind); setDetails(saved.details);
          }
        } catch { /* The form can still display requests when local recovery is unavailable. */ }
      }
    })().catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !owner || (kind === "delete_account" && !confirmed)) return;
    const validation = validateDataControlRequest(kind, details);
    if (validation) { setError(validation); return; }
    lock.current = true; setBusy(true); setError(null); setNotice(null);
    const storageKey = `fintrack:data-request:v1:${owner}`;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id !== owner) throw new Error("Session changed. Reload before submitting.");
      if (!pending.current) {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try { const parsed = JSON.parse(saved); if (typeof parsed.id === "string" && typeof parsed.details === "string" && labels[parsed.kind as DataControlKind]) { pending.current = parsed; setRecovery(parsed); } } catch { localStorage.removeItem(storageKey); }
        }
      }
      if (pending.current && (pending.current.kind !== kind || pending.current.details !== details.trim())) throw new Error("A previous request is awaiting confirmation. Restore its type and details, then retry.");
      const attempt = pending.current ?? { id: crypto.randomUUID(), kind, details: details.trim() };
      pending.current = attempt; setRecovery(attempt);
      localStorage.setItem(storageKey, JSON.stringify(attempt));
      const result = await submitDataControlRequest(supabase, attempt.id, kind, details);
      setRequests(current => [result, ...current.filter(item => item.id !== result.id)]);
      localStorage.removeItem(storageKey); pending.current = null; setRecovery(null);
      setNotice("Request recorded for review. Your account and data have not been deleted.");
      setDetails(""); setConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request not confirmed. Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function cancel(id: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.rpc("cancel_data_control_request", { request_id: id });
      if (error || !data) throw new Error("Cancellation not confirmed. Reload to check the request status.");
      setRequests(current => current.map(item => item.id === id ? data as DataControlRequest : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cancellation unavailable."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="app-page"><Navbar/><main id="main-content" tabIndex={-1} className="app-page-content max-w-2xl space-y-5 outline-none">
    <PageHeader eyebrow="Your account" title="Data & support requests" description="Submit a request from your signed-in account and check its status here."/>
    <Surface className="p-5"><form onSubmit={submit} className="space-y-4">
      <Field label="Request type" htmlFor="request-type"><select id="request-type" className={fieldControlStyles} value={kind} onChange={event => { setKind(event.target.value as DataControlKind); setConfirmed(false); }}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Details" htmlFor="request-details"><textarea id="request-details" rows={4} maxLength={2000} required={kind !== "delete_account"} className={fieldControlStyles} value={details} onChange={event => setDetails(event.target.value)}/></Field>
      <p className="text-sm text-on-surface-variant">Do not include passwords, PINs, card numbers, or receipt images. Export your records from Reports before requesting deletion.</p>
      {kind === "delete_account" && <><p className="text-sm text-on-surface-variant">This queues an account deletion request for review. It does not immediately delete your account, cancel a payment, or remove data from another device.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>I understand this submits a request for review</label></>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      <Button type="submit" disabled={busy || !owner || (kind === "delete_account" && !confirmed)}>{busy ? "Please wait…" : "Submit request"}</Button>
      {recovery && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setKind(recovery.kind); setDetails(recovery.details); }}>Restore unconfirmed request</Button>}
    </form></Surface>
    <Surface className="space-y-4 p-5"><h2 className="text-lg font-semibold">Your requests</h2>{!requests.length && <p className="text-sm text-on-surface-variant">No requests to display.</p>}{requests.map(request => <article key={request.id} className="space-y-2 border-b border-outline-variant py-3 last:border-0"><div className="flex justify-between gap-3"><h3 className="font-semibold">{labels[request.kind]}</h3><span className="text-sm">{request.status}</span></div><p className="text-sm whitespace-pre-wrap break-words">{request.details || "Account deletion requested."}</p><p className="text-xs text-on-surface-variant">{new Date(request.created_at).toLocaleString()} · {request.id}</p>{request.outcome && <p className="text-sm">{request.outcome}</p>}{request.status === "pending" && <Button type="button" variant="secondary" disabled={busy} onClick={() => void cancel(request.id)}>Cancel request</Button>}</article>)}</Surface>
    <p className="text-sm"><Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link> · <Link href="/support" className="underline">Support</Link></p>
  </main></div>;
}
