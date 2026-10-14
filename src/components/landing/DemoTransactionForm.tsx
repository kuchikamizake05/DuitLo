"use client";
import { ArrowUp, ArrowDown, ChevronDown, Wallet, Utensils, Camera } from "lucide-react";
import type { ReferenceTransactionForm } from "@/components/reference/TransactionEditor";
import styles from "./landing.module.css";
export default function DemoTransactionForm({ form, onChange, onDone, english }: { form: ReferenceTransactionForm; onChange: (form: ReferenceTransactionForm) => void; onDone: () => void; english: boolean }) {
  const c=(id:string,en:string)=>english?en:id;
  return <form className={styles.clonedCatat} onSubmit={event=>{event.preventDefault();onDone();}}>
    <h3>{c("Catat Transaksi","Record transaction")}</h3><p>{c("Kelola arus keuanganmu","Manage your cash flow")}</p>
    <div className={styles.cloneType}>{(["expense","income"] as const).map(type=><button key={type} type="button" data-active={form.type===type} data-type={type} onClick={()=>onChange({...form,type})}>{type==="expense"?<ArrowUp size={14}/>:<ArrowDown size={14}/>} {c(type==="expense"?"Pengeluaran":"Pemasukan",type==="expense"?"Expense":"Income")}</button>)}</div>
    <label>{c("Nominal Transaksi","Transaction amount")}<div className={styles.cloneAmount}><span>Rp</span><input required inputMode="numeric" value={Number(form.amount||0).toLocaleString("id-ID")} onChange={event=>onChange({...form,amount:event.target.value.replace(/\D/g,"")})}/></div></label>
    <div className={styles.cloneChips}>{[10000,20000,50000].map(amount=><button key={amount} type="button" onClick={()=>onChange({...form,amount:String(Number(form.amount)+amount)})}>+{amount/1000}K</button>)}</div>
    <label>{c("Rekening Sumber Dana","Source account")}<div className={styles.cloneSelect}><Wallet size={18}/><span>{c("Dompet contoh","Sample wallet")}<small>Rp500.000 → Rp{(500000+(form.type==="expense"?-1:1)*Number(form.amount||0)).toLocaleString("id-ID")}</small></span><ChevronDown size={14}/></div></label>
    <label>{c("Kategori Transaksi","Transaction category")}<div className={styles.cloneSelect}><Utensils size={18}/><select value={form.category} onChange={event=>onChange({...form,category:event.target.value})}><option value="Makanan">{c("Makanan","Food")}</option><option value="Belanja">{c("Belanja","Shopping")}</option><option value="Lainnya">{c("Lainnya","Other")}</option></select></div></label>
    <label>Merchant<input className={styles.cloneInput} value={form.merchant} onChange={event=>onChange({...form,merchant:event.target.value})}/></label>
    <button className={styles.cloneSave} type="submit">{c("Simpan Transaksi","Save transaction")}</button><button className={styles.cloneRetry} type="button" onClick={onDone}><Camera size={14}/>{c("Foto lagi","Take another photo")}</button>
  </form>;
}
