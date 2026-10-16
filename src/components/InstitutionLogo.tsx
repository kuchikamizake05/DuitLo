"use client";
/* eslint-disable @next/next/no-img-element */
import {useState} from "react";
import {Landmark,Wallet,Banknote} from "lucide-react";
import {findInstitution} from "@/lib/institutions";
import approvedLogos from "@/lib/institution-logo-overrides.json";
import marks from "@/lib/institution-marks.json";
export function InstitutionLogo({name,kind,className="h-8 w-8"}:{name:string;kind?:string;className?:string}){
  const institution=findInstitution(name);
  const [failed,setFailed]=useState<string|null>(null);
  const approved=institution?(approvedLogos as Record<string,{src:string;background:string;approvedAt:string}>)[institution.id]:undefined;
  const isCash=kind==="cash"||(!institution&&/cash|tunai/i.test(name));
  const Icon=isCash?Banknote:kind==="ewallet"?Wallet:Landmark;
  return <span data-institution-logo className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${approved||isCash?"":"p-1.5"} text-slate-600 ${className}`} style={{backgroundColor:isCash?"#e3f1df":approved?.background??"#fff"}}>
    {isCash?<img src="/institutions/cash.svg" alt={name} className="block h-full w-full object-contain" style={{width:"60%",height:"60%"}}/>:institution&&failed!==institution.id?<img src={approved?`${approved.src}?v=${encodeURIComponent(approved.approvedAt)}`:`/institutions/${institution.id}${marks.includes(institution.id)?"-mark":""}.svg`} alt={institution.name} className="block h-full w-full object-contain" onError={()=>setFailed(institution.id)}/>:<Icon aria-label={name} className="h-full w-full" strokeWidth={2.5}/>}
  </span>;
}
