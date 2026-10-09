"use client";
/* eslint-disable @next/next/no-img-element */
import {useState} from "react";
import {Landmark,Wallet,Coins} from "lucide-react";
import {findInstitution} from "@/lib/institutions";
import approvedLogos from "@/lib/institution-logo-overrides.json";
import marks from "@/lib/institution-marks.json";
export function InstitutionLogo({name,kind,className="h-8 w-8"}:{name:string;kind?:string;className?:string}){
  const institution=findInstitution(name);
  const [failed,setFailed]=useState<string|null>(null);
  const approved=institution?(approvedLogos as Record<string,{src:string;background:string;approvedAt:string}>)[institution.id]:undefined;
  const Icon=/cash|tunai/i.test(`${name} ${kind}`)?Coins:kind==="ewallet"?Wallet:Landmark;
  return <span data-institution-logo className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${approved?"":"p-1.5"} text-slate-600 ${className}`} style={{backgroundColor:approved?.background??"#fff"}}>
    {institution&&failed!==institution.id?<img src={approved?`${approved.src}?v=${encodeURIComponent(approved.approvedAt)}`:`/institutions/${institution.id}${marks.includes(institution.id)?"-mark":""}.svg`} alt={institution.name} className="block h-full w-full object-contain" onError={()=>setFailed(institution.id)}/>:<Icon aria-label={name} className="h-full w-full" strokeWidth={2.5}/>}
  </span>;
}
