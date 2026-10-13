"use client";
import {useEffect,useRef,useState} from "react";
import {Delete,Fingerprint,LoaderCircle,LockKeyhole} from "lucide-react";
import {AuthShell} from "@/components/AuthShell";
import {PinSetupForm} from "@/components/PinSetupForm";
import {getPasskeyErrorMessage,isWebAuthnSupported} from "@/lib/passkeys";
import {configureDevicePin,hasDevicePin,verifyDevicePin} from "@/lib/device-pin";
import {useLanguage} from "@/components/LanguageProvider";
import {supabase} from "@/infrastructure/supabase/browser-client";
import styles from "@/app/login/login.module.css";
type Props={emailHint:string;userId:string;onUnlock:()=>void;onUseNormalLogin:()=>Promise<void>};
export default function PasskeyUnlockScreen({emailHint,userId,onUnlock,onUseNormalLogin}:Props){
 const {t}=useLanguage();const [pin,setPin]=useState("");const [checking,setChecking]=useState(false);const [error,setError]=useState("");const [retryAt,setRetryAt]=useState(0);const [now,setNow]=useState(0);const [setup,setSetup]=useState(false);const checkingRef=useRef(false);const pinReady=hasDevicePin(userId);
 useEffect(()=>{if(!retryAt)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[retryAt]);
 const blocked=retryAt>now;
 async function verify(pinValue:string){
  if(checkingRef.current||!pinReady||blocked)return;checkingRef.current=true;setChecking(true);setError("");
  try{const result=await verifyDevicePin(userId,pinValue);if(result.ok){onUnlock();return;}setPin("");setRetryAt(result.retryAt);setNow(result.checkedAt);setError(t(result.retryAt?"Terlalu banyak percobaan. Tunggu sebentar.":"PIN tidak sesuai. Coba lagi."));}catch{setError(t("PIN belum dapat diverifikasi. Gunakan biometrik atau login biasa."));}finally{checkingRef.current=false;setChecking(false);}
 }
 async function biometric(){
  if(checkingRef.current)return;checkingRef.current=true;setChecking(true);setError("");
  try{const {data,error}=await supabase.auth.signInWithPasskey();if(error)throw error;if(!data.session||data.session.user.id!==userId){await onUseNormalLogin();return;}if(pinReady)onUnlock();else setSetup(true);}catch(caught){setError(t(getPasskeyErrorMessage(caught)));}finally{checkingRef.current=false;setChecking(false);}
 }
 async function normalLogin(){if(checkingRef.current)return;checkingRef.current=true;setChecking(true);try{await onUseNormalLogin();}catch{setError(t("Sesi belum dapat ditutup. Coba lagi."));}finally{checkingRef.current=false;setChecking(false);}}
 function enter(value:string){if(checking||blocked||!pinReady||pin.length>=6)return;const next=pin+value;setPin(next);if(next.length===6)void verify(next);}
 return <AuthShell titleId="passkey-unlock-title" variant="unlock" footer={!setup&&<button type="button" disabled={checking} onClick={()=>void normalLogin()} className="w-full min-h-11 text-sm font-medium text-[var(--ink-soft)]">{t("Lupa PIN? Login kembali")}</button>}><div className="mb-6"><h1 id="passkey-unlock-title" className={styles.cardTitle}>{t(setup?"Buat PIN perangkat":"Buka FinTrack")}</h1><p className="mt-2 text-sm text-[var(--ink-soft)]">{t(setup?"Gunakan PIN 6 digit untuk membuka aplikasi di perangkat ini.":pinReady?"Masukkan PIN 6 digitmu.":"Verifikasi biometrik untuk membuat PIN perangkat.")}</p><p className={styles.accountHint}><LockKeyhole size={12} aria-hidden="true"/>{emailHint}</p></div>
 {setup?<PinSetupForm onSave={async value=>{await configureDevicePin(userId,value);onUnlock();}}/>:<><label className="sr-only" htmlFor="unlock-pin">{t("PIN perangkat")}</label><div className={styles.pinEntry}><div className={styles.pinDots} aria-hidden="true">{Array.from({length:6},(_,index)=><span key={index} data-filled={index<pin.length}/>)}</div><input id="unlock-pin" className={styles.pinInput} type="password" inputMode="none" autoComplete="off" maxLength={6} placeholder="••••••" disabled={checking||blocked||!pinReady} value={pin} onChange={event=>{const next=event.target.value.replace(/[^0-9]/g,"").slice(0,6);setPin(next);if(next.length===6)void verify(next);}} aria-describedby={error?"pin-unlock-error":undefined}/></div>
 {error&&<p id="pin-unlock-error" role="alert" className={styles.error}>{error}{blocked&&<span className="block mt-1">{Math.ceil((retryAt-now)/1000)} {t("detik")}</span>}</p>}
 <div className={styles.keypad}>{["1","2","3","4","5","6","7","8","9"].map(value=><button type="button" key={value} className={styles.key} disabled={checking||blocked||!pinReady} onClick={()=>enter(value)}>{value}</button>)}<button type="button" aria-label={t("Buka dengan biometrik")} title={t("Buka dengan biometrik")} className={styles.key} disabled={checking||!isWebAuthnSupported()} onClick={()=>void biometric()}>{checking?<LoaderCircle aria-hidden="true" className="size-6 motion-safe:animate-spin"/>:<Fingerprint aria-hidden="true" className="size-6"/>}</button><button type="button" className={styles.key} disabled={checking||blocked||!pinReady} onClick={()=>enter("0")}>0</button><button type="button" aria-label={t("Hapus digit PIN")} className={styles.key} disabled={checking||!pin.length} onClick={()=>setPin(value=>value.slice(0,-1))}><Delete className="size-5" aria-hidden="true"/></button></div>
</>}
 </AuthShell>;
}
