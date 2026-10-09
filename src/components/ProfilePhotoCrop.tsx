"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from "react";
import {DialogFrame} from "./ui/DialogFrame";
import {useLanguage} from "./LanguageProvider";
import {getProfileCrop,type PhotoCrop} from "@/lib/profile-photo";

export function ProfilePhotoCrop({file,busy,error,onSave,onClose}:{file:File;busy:boolean;error:string|null;onSave:(crop:PhotoCrop)=>Promise<boolean>;onClose:()=>void}){
  const {t}=useLanguage();
  const preview=useRef<HTMLImageElement>(null);
  const [dimensions,setDimensions]=useState({width:0,height:0});
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [decodeError,setDecodeError]=useState(false);
  const pointer=useRef<{id:number;x:number;y:number}|null>(null);
  const crop=dimensions.width?getProfileCrop(dimensions.width,dimensions.height,zoom,pan.x,pan.y):null;
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);if(preview.current)preview.current.src=objectUrl;return()=>URL.revokeObjectURL(objectUrl);},[file]);
  const clamp=(value:number)=>Math.max(-1,Math.min(1,value));
  return <DialogFrame titleId="profile-crop-title" descriptionId="profile-crop-description" onClose={onClose} closeDisabled={busy} contentClassName="!max-w-sm">
    <div className="p-5 space-y-4">
      <h2 id="profile-crop-title" className="text-headline-sm font-bold text-on-surface">{t("Potong foto profil")}</h2>
      <p id="profile-crop-description" className="text-body-sm text-on-surface-variant">{t("Geser foto dan atur zoom agar pas di lingkaran.")}</p>
      <div role="group" aria-label={t("Posisi foto")} tabIndex={busy?-1:0} className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-container touch-none cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-primary"
        onKeyDown={event=>{if(busy)return;const shifts:Record<string,[number,number]>={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,-.05],ArrowDown:[0,.05]};const shift=shifts[event.key];if(shift){event.preventDefault();setPan(current=>({x:clamp(current.x+shift[0]),y:clamp(current.y+shift[1])}));}}}
        onPointerDown={event=>{if(busy||!crop)return;event.currentTarget.setPointerCapture(event.pointerId);pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};}}
        onPointerMove={event=>{const last=pointer.current;if(busy||!last||last.id!==event.pointerId||!crop)return;const view=event.currentTarget.getBoundingClientRect().width;const dx=event.clientX-last.x,dy=event.clientY-last.y;pointer.current={id:last.id,x:event.clientX,y:event.clientY};setPan(current=>({x:dimensions.width>crop.size?clamp(current.x-2*dx*crop.size/(view*(dimensions.width-crop.size))):0,y:dimensions.height>crop.size?clamp(current.y-2*dy*crop.size/(view*(dimensions.height-crop.size))):0}));}}
        onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}>
        <img ref={preview} alt={t("Pratinjau foto profil")} draggable={false} onLoad={event=>setDimensions({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>setDecodeError(true)} className="absolute block max-w-none select-none" style={crop?{width:`${dimensions.width/crop.size*100}%`,height:`${dimensions.height/crop.size*100}%`,left:`${-crop.x/crop.size*100}%`,top:`${-crop.y/crop.size*100}%`}:{width:"100%",height:"100%",objectFit:"contain"}}/>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90" style={{boxShadow:"0 0 0 200px rgba(0,0,0,.5)"}}/>
      </div>
      <label className="block text-body-sm text-on-surface">{t("Zoom")}<input aria-label={t("Zoom")} type="range" min="1" max="4" step="0.02" value={zoom} disabled={busy||!crop||decodeError} onChange={event=>setZoom(Number(event.target.value))} className="mt-2 block w-full accent-[var(--color-primary)]"/></label>
      {(error||decodeError)&&<p role="alert" className="text-body-sm text-error">{t(decodeError?"Foto belum dapat diproses. Coba lagi.":error!)}</p>}
      <div className="flex gap-3"><button type="button" disabled={busy} onClick={onClose} className="flex-1 rounded-full bg-surface-container px-4 py-3 font-semibold text-on-surface disabled:opacity-50">{t("Batal")}</button><button type="button" disabled={busy||!crop||decodeError} onClick={async()=>{if(crop&&await onSave(crop))onClose();}} className="flex-1 rounded-full bg-primary-container px-4 py-3 font-semibold text-on-primary disabled:opacity-50">{t(busy?"Menyimpan...":"Simpan")}</button></div>
    </div>
  </DialogFrame>;
}
