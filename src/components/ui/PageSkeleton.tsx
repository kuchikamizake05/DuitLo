"use client";
import {useLanguage} from "@/components/LanguageProvider";
type Variant="dashboard"|"wallet"|"activity"|"insights"|"portfolio"|"settings"|"budget"|"goals"|"trading"|"archive"|"receipt"|"journey"|"onboarding";
function Line({width="55%",height=12}:{width?:string;height?:number}){return <div className="ft-skeleton-line" style={{width,height}}/>;}
function Rows({count=3}:{count?:number}){return <div className="ft-skeleton-rows">{Array.from({length:count},(_,i)=><div key={i} className="ft-skeleton-row"><div className="ft-skeleton-circle"/><div className="ft-skeleton-copy"><Line width="65%" height={15}/><Line width="45%" height={10}/></div><Line width="22%" height={15}/></div>)}</div>;}
export function PageSkeleton({variant="dashboard"}:{variant?:Variant}){
 const {t}=useLanguage();
 return <div className={`ft-skeleton ft-skeleton-${variant}`} role="status" aria-busy="true" aria-label={t("Memuat data")}><span className="sr-only">{t("Memuat data")}</span><div aria-hidden="true" className="ft-skeleton-content">
 <div className="ft-skeleton-heading"><Line width="42%" height={24}/><Line width="22%" height={30}/></div>
 {!['settings','archive','receipt','trading','journey','onboarding'].includes(variant)&&<div className="ft-skeleton-card ft-skeleton-hero"><Line width="40%"/><Line width="60%" height={34}/><Line width="35%"/><div className="ft-skeleton-divider"/><Rows count={1}/></div>}
 {variant==="activity"&&<div className="ft-skeleton-card"><div className="ft-skeleton-calendar">{Array.from({length:28},(_,i)=><Line key={i} width="65%" height={18}/>)}</div></div>}
 {variant==="insights"&&<div className="ft-skeleton-card"><Line width="45%" height={18}/><div className="ft-skeleton-donut"/><Rows/></div>}
 {variant==="dashboard"&&<div className="ft-skeleton-card"><Line width="45%" height={18}/><div className="ft-skeleton-week">{Array.from({length:7},(_,i)=><div key={i} className="ft-skeleton-circle"/>)}</div></div>}
 {[0,1].map(i=><div key={i} className="ft-skeleton-card"><Rows count={variant==="goals"?1:2}/></div>)}
 </div></div>;
}
