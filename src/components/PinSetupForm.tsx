"use client";
import {useState} from "react";
import {LoaderCircle} from "lucide-react";
import {useLanguage} from "@/components/LanguageProvider";
import styles from "@/app/login/login.module.css";
export function PinSetupForm({onSave,onCancel}:{onSave:(pin:string)=>Promise<void>;onCancel?:()=>void}){
 const {t}=useLanguage();const [pin,setPin]=useState("");const [confirmation,setConfirmation]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 return <form className={styles.pinForm} onSubmit={async event=>{event.preventDefault();if(busy)return;if(pin!==confirmation){setError(t("Konfirmasi PIN tidak sama."));return;}if(!/^[0-9]{6}$/.test(pin)){setError(t("Gunakan PIN 6 digit."));return;}setBusy(true);setError("");try{await onSave(pin);setPin("");setConfirmation("");}catch{setError(t("PIN belum dapat disimpan. Coba lagi."));}finally{setBusy(false);}}}>
  <label className="mb-2 block text-body-sm" htmlFor="new-device-pin">{t("PIN baru")}</label><input className="w-full px-4 py-3" id="new-device-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="[0-9]{6}" required disabled={busy} value={pin} onChange={event=>setPin(event.target.value.replace(/[^0-9]/g,""))}/>
  <label className="mb-2 mt-4 block text-body-sm" htmlFor="confirm-device-pin">{t("Konfirmasi PIN")}</label><input className="w-full px-4 py-3" id="confirm-device-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="[0-9]{6}" required disabled={busy} value={confirmation} onChange={event=>setConfirmation(event.target.value.replace(/[^0-9]/g,""))}/>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  <button type="submit" disabled={busy||pin.length!==6||confirmation.length!==6} className={`${styles.primary} mt-6`}>{busy&&<LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin"/>}{t(busy?"Menyimpan...":"Simpan PIN")}</button>
  {onCancel&&<button type="button" disabled={busy} onClick={onCancel} className={`${styles.secondary} mt-3`}>{t("Batal")}</button>}
 </form>;
}
