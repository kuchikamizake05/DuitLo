"use client";
/* eslint-disable @next/next/no-img-element */
import {useState,type HTMLAttributes} from "react";
import {UserRound} from "lucide-react";
import {useProfilePhoto} from "./ProfilePhotoProvider";
import {useLanguage} from "./LanguageProvider";

export function ProfileAvatar({className="",...props}:HTMLAttributes<HTMLSpanElement>){
  const {url}=useProfilePhoto();
  const {t}=useLanguage();
  const [failed,setFailed]=useState<string|null>(null);
  return <span {...props} className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-container-high text-on-surface-variant ${className}`} aria-label={t("Foto profil")}>
    {url&&url!==failed?<img src={url} alt={t("Foto profil")} className="h-full w-full object-cover" onError={()=>setFailed(url)}/>:<UserRound aria-hidden="true" className="h-[55%] w-[55%]" strokeWidth={2.4}/>}
  </span>;
}
