"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReferencePart } from "./runtime";
import {useTheme} from "@/components/ThemeProvider";
import { useLanguage } from "@/components/LanguageProvider";
import type { AccountOverviewRecord } from "@/lib/accounts";
import {cardPalettes} from "@/lib/account-display";
import {InstitutionLogo} from "@/components/InstitutionLogo";
import { institutionBadge } from "./AccountEditors";
import { getAccountKindLabel } from "@/lib/accounts";

export function WalletView({ accounts, onAdd, onTransfer, onDetail }: { accounts: AccountOverviewRecord[]; onAdd: () => void; onTransfer: () => void; onDetail: (account: AccountOverviewRecord) => void }) {
  const { language, t } = useLanguage();
  const {theme}=useTheme();
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  useEffect(()=>{const timer=window.setTimeout(()=>{try {const value=localStorage.getItem("fintrack-show-balances");if(value==="false")setVisible(false);}catch{}},0);return()=>window.clearTimeout(timer);},[]);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("all");
  const active = accounts.filter(account => account.is_active);
  const kind = (account: AccountOverviewRecord) => /tunai|cash/i.test(`${account.name} ${account.institution}`) ? "cash" : account.kind;
  const filtered = active.filter(account => filter === "all" || kind(account) === filter);
  const assets = active.filter(account => account.kind !== "liability" && account.includeInNetWorth!==false);
  const available = assets.every(account => account.currency === "IDR" || account.reporting_balance_idr != null);
  const balance = assets.reduce((sum,account)=>sum+Number(account.currency==="IDR"?account.current_balance:account.reporting_balance_idr??0),0);
  const money = (account: AccountOverviewRecord) => visible && !hidden[account.id] ? new Intl.NumberFormat(language==="en"?"en-ID":"id-ID",{style:"currency",currency:account.currency,maximumFractionDigits:account.currency==="IDR"?0:2}).format(account.current_balance) : `${account.currency==="IDR"?"Rp":account.currency} ••••••`;
  const total = !visible ? "Rp ••••••••••" : available ? new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(balance) : "—";
  const cards = <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pt-1 pb-0">
    {active.length ? active.map((account,index)=><ReferencePart key={account.id} page="dompet" part="wallet-card" values={{"Rekening Finansial":t(getAccountKindLabel(account.kind)),"Bank BCA":account.name,"BCA":institutionBadge(account.institution||account.name),"Rekening Utama":account.institution??t(getAccountKindLabel(account.kind)),"Rp 14.500.000":money(account),"•••• •••• 8829":account.currency,"icon:visibility":visible&&!hidden[account.id]?"visibility":"visibility_off"}}
      attributes={{"dompet.35":{className:"flex items-center justify-center shrink-0"},"dompet.29":{role:"button",tabIndex:0,"aria-label":`${t("Detail Rekening")} ${account.name}`,onClick:()=>onDetail(account),onKeyDown:(event:React.KeyboardEvent)=>{if(event.target===event.currentTarget&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onDetail(account);}},style:{cursor:"pointer",background:`linear-gradient(125deg,${cardPalettes[account.cardColor??""]??["#11315b,#194b80,#2b65a0","#104238,#176558,#23816e","#102e25,#1b4e3b,#27674e","#252a34,#383f4d,#4d5668"][index%4]})`}},"dompet.41":{onClick:(event:React.MouseEvent)=>{event.stopPropagation();setHidden(current=>({...current,[account.id]:!current[account.id]}));},"aria-label":t(hidden[account.id]?"Tampilkan saldo":"Sembunyikan saldo")}}}
      onAction={()=>setHidden(current=>({...current,[account.id]:!current[account.id]}))}/>) : <button type="button" onClick={onAdd} className="w-[285px] min-h-[216px] rounded-2xl bg-surface-container-lowest p-space-lg text-primary font-bold">{t("Tambah Akun")}</button>}
  </div>;
  const rows = <section className="flex flex-col gap-3">{filtered.length ? filtered.map(account=><ReferencePart key={account.id} page="dompet" part="account-row" values={{"Bank BCA":account.name,"Utama":"","Rekening Giro / Payroll":account.institution??t(getAccountKindLabel(account.kind)),"Rp 14.500.000":money(account),"Tersinkron":t("Aktif"),"icon:account_balance":<InstitutionLogo name={account.institution||account.name} kind={kind(account)} className="h-11 w-11"/>,"icon:sync":"check_circle"}}
    attributes={{"dompet.107":{className:"w-11 h-11 flex items-center justify-center shrink-0"},"dompet.105":{role:"button",tabIndex:0,onClick:()=>onDetail(account),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==="Enter")onDetail(account);}}}}/>) : <p className="p-4 rounded-[32px] bg-surface-container-lowest text-body-md text-on-surface-variant">{t(accounts.length?"Tidak ada akun dalam kelompok ini":"Mulai dari dompet pertamamu")}</p>}</section>;
  const filterAttributes = Object.fromEntries(["all","bank","ewallet","cash"].map((value,index)=>[`dompet.${100+index}`,{"aria-pressed":filter===value,className:`shrink-0 px-4 py-1.5 rounded-full text-label-md font-semibold ${filter===value?"bg-secondary-container text-on-secondary-container":"bg-surface-container-lowest text-on-surface-variant"}`} ]));
  return <ReferencePart page="dompet" values={{"Total Saldo Semua Akun":t(active.some(account=>account.includeInNetWorth===false)?"Saldo dalam perhitungan":"Total Saldo Semua Akun"),"icon:add":<span style={{fontSize:20,fontWeight:700,fontVariationSettings:'"wght" 700',WebkitTextStroke:"0.6px currentColor",color:theme==="dark"?"#16417d":"#ffffff"}}>add</span>,"Rp 42.357.852":total,"Sembunyikan":t(visible?"Sembunyikan":"Tampilkan"),"icon:visibility":visible?"visibility":"visibility_off","10 Terdaftar":`${active.length} ${t("Terdaftar")}`,"Semua (10)":`${t("Semua")} (${active.length})`,"Bank (4)":`Bank (${active.filter(account=>account.kind==="bank").length})`,"E-Wallet (4)":`E-Wallet (${active.filter(account=>account.kind==="ewallet").length})`,"Tunai (2)":`${t("Tunai")} (${active.filter(account=>kind(account)==="cash").length})`}}
    slots={{"wallet-cards":cards,"section-5":rows}} attributes={filterAttributes}
    onAction={action=>{if(action==="toggle-privacy-btn")setVisible(!visible);else if(/Transfer Saldo/.test(action))onTransfer();else if(/Tambah Akun|tambah-akun/.test(action))onAdd();else if(/Kelola Limit/.test(action))router.push("/planning");else if(action.startsWith("Semua"))setFilter("all");else if(action.startsWith("Bank ("))setFilter("bank");else if(action.startsWith("E-Wallet"))setFilter("ewallet");else if(action.startsWith("Tunai"))setFilter("cash");}}/>;
}
