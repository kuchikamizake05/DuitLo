"use client";
import {PinSetupForm} from "@/components/PinSetupForm";
import {DialogFrame} from "@/components/ui/DialogFrame";
import {configureDevicePin,hasDevicePin,clearDevicePin} from "@/lib/device-pin";
import {Download,Fingerprint} from "lucide-react";
import authStyles from "@/app/login/login.module.css";
import {PageSkeleton} from "@/components/ui/PageSkeleton";

import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { ReferenceRoot } from "@/components/reference/runtime";
import { SettingsView } from "@/components/reference/SettingsView";
import { useTheme } from "@/components/ThemeProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Surface } from "@/components/ui/Surface";
import { supabase } from "@/infrastructure/supabase/browser-client";
import { clearPasskeyDeviceState,getPasskeyErrorMessage,isWebAuthnSupported,maskPasskeyEmail,readPasskeyDeviceState,writePasskeyDeviceState } from "@/lib/passkeys";
import { getNetworkSnapshot,getServerNetworkSnapshot,subscribeToNetworkStatus } from "@/lib/pwa";
import { useRouter } from "next/navigation";
import { useEffect,useRef,useState,useSyncExternalStore } from "react";

export default function SettingsPage() {
  const { language, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [userName,setUserName]=useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [passkeys, setPasskeys] = useState<Array<{ id: string; friendly_name?: string; created_at: string; last_used_at?: string }>>([]);
  const [passkeyBusy, setPasskeyBusy] = useState<"enroll" | "delete" | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyDeleteId, setPasskeyDeleteId] = useState<string | null>(null);
  const [deviceLockEnabled, setDeviceLockEnabled] = useState(false);
  const [pinSetupOpen,setPinSetupOpen]=useState(false);
  const [pinSetupReady,setPinSetupReady]=useState(false);
  const [pinSetupBusy,setPinSetupBusy]=useState(false);
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);
  const [standalone, setStandalone] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) {
        setLoading(false);
        if (navigator.onLine) router.push("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setUserName(session.user.user_metadata?.full_name??session.user.email?.split("@")[0]??"FinTrack");
      setUserId(session.user.id);
      setDeviceLockEnabled(Boolean(readPasskeyDeviceState(session.user.id)?.enabled));
      const { data, error } = await supabase.auth.passkey.list();
      if (!active) return;
      if (!error) {
        setPasskeys(Array.isArray(data)?data:[]);
      }
      setLoading(false);
    };
    void fetchUser().catch(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  }, [router]);

  useEffect(() => {
    const displayQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => setStandalone(displayQuery.matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
    updateStandalone();
    displayQuery.addEventListener("change", updateStandalone);
    return () => {
      displayQuery.removeEventListener("change", updateStandalone);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (userId) clearPasskeyDeviceState(userId);
      router.push("/login");
    } catch {
      setLogoutError("Sesi belum dapat ditutup. Coba lagi.");
    } finally {
      setLoggingOut(false);
    }
  }

  async function copyUserId() {
    if (!userId) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopyError(t("Identitas belum dapat disalin. Pilih tampilkan lalu salin manual."));
    }
  }

  async function refreshPasskeys() {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) throw error;
    setPasskeys(Array.isArray(data)?data:[]);
    return Array.isArray(data)?data:[];
  }

  async function enrollPasskey() {
    if (!userId || passkeyBusy || !isWebAuthnSupported()) return;
    if(!hasDevicePin(userId)){setPinSetupReady(false);setPinSetupOpen(true);return;}
    setPasskeyBusy("enroll");
    setPasskeyError(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      const nextPasskeys = await refreshPasskeys();
      if (nextPasskeys.length) {
        writePasskeyDeviceState({ userId, emailHint: maskPasskeyEmail(userEmail), enabled: true, locked: false });
        setDeviceLockEnabled(true);
        setPinSetupOpen(false);
      }
    } catch (error) {
      setPasskeyError(getPasskeyErrorMessage(error));
    } finally {
      setPasskeyBusy(null);
    }
  }

  async function deletePasskey() {
    if (!passkeyDeleteId || !userId) return;
    setPasskeyBusy("delete");
    setPasskeyError(null);
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: passkeyDeleteId });
      if (error) throw error;
      const nextPasskeys = await refreshPasskeys();
      if (!nextPasskeys.length) {
        clearPasskeyDeviceState(userId);
        setDeviceLockEnabled(false);
      }
      setPasskeyDeleteId(null);
    } catch (error) {
      setPasskeyError(getPasskeyErrorMessage(error));
    } finally {
      setPasskeyBusy(null);
    }
  }

  function toggleDeviceLock(enabled: boolean) {
    if (!userId) return;
    if (!enabled) {setDeviceLockEnabled(false);clearPasskeyDeviceState(userId);return;}
    if (!isWebAuthnSupported()) return;
    if (!hasDevicePin(userId)) {setPinSetupReady(false);setPinSetupOpen(true);return;}
    if (!passkeys.length) {void enrollPasskey();return;}
    writePasskeyDeviceState({userId,emailHint:maskPasskeyEmail(userEmail),enabled:true,locked:false});
    setDeviceLockEnabled(true);
  }
  function closePinSetup(){
    if(pinSetupBusy||passkeyBusy)return;
    if(userId&&!deviceLockEnabled)clearDevicePin(userId);
    setPinSetupOpen(false);setPinSetupReady(false);setPasskeyError(null);
  }
  async function saveDevicePin(pin:string){
    if(!userId)return;
    setPinSetupBusy(true);
    try{await configureDevicePin(userId,pin);setPinSetupReady(true);if(passkeys.length){toggleDeviceLock(true);setPinSetupOpen(false);}}finally{setPinSetupBusy(false);}
  }

  function lockNow() {
    if (!userId || !deviceLockEnabled || !passkeys.length) return;
    writePasskeyDeviceState({ userId, emailHint: maskPasskeyEmail(userEmail), enabled: true, locked: true });
  }

  return (
    <ReferenceRoot page="pengaturan">
      <Navbar />
      {loading?<main className="pt-20 px-margin" aria-busy="true"><SettingsSkeleton/></main>:<SettingsView email={userEmail} name={userName} online={online} biometric={deviceLockEnabled} biometricAvailable={isWebAuthnSupported()} onBiometric={toggleDeviceLock} onEnroll={()=>void enrollPasskey()} onLock={lockNow} onLogout={()=>void handleLogout()} loggingOut={loggingOut} passkeys={passkeys} onDeletePasskey={setPasskeyDeleteId} error={passkeyError??logoutError}/>}

      {!loading&&!standalone&&<section className="mx-margin mb-24 rounded-3xl bg-surface-container-low p-5"><h2 className="text-title-md font-semibold">{t("Pasang FinTrack")}</h2><p className="mt-2 text-body-sm text-on-surface-variant">{t("Buka lebih cepat dari layar utama dan nikmati tampilan penuh seperti aplikasi.")}</p><button type="button" onClick={()=>window.dispatchEvent(new Event("fintrack:request-install"))} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--create-bg)] px-4 text-sm font-semibold text-[var(--create-fg)]"><Download size={18} aria-hidden="true"/>{t("Pasang FinTrack")}</button></section>}

      {pinSetupOpen&&<DialogFrame titleId="settings-pin-title" onClose={closePinSetup} closeDisabled={pinSetupBusy||Boolean(passkeyBusy)}><div className="p-5"><h2 id="settings-pin-title" className="text-headline-sm font-semibold">{t(pinSetupReady?"Aktifkan biometrik":"Buat PIN perangkat")}</h2><p className="mt-2 mb-5 text-body-sm text-on-surface-variant">{t(pinSetupReady?"Tekan tombol di bawah untuk mendaftarkan biometrik perangkat.":"Gunakan PIN 6 digit untuk membuka aplikasi di perangkat ini.")}</p>{pinSetupReady?<div className={authStyles.pinForm}><button type="button" disabled={Boolean(passkeyBusy)} className={authStyles.primary} onClick={()=>void enrollPasskey()}><Fingerprint aria-hidden="true" className="size-5"/>{t(passkeyBusy?"Memproses...":"Aktifkan biometrik")}</button>{passkeyError&&<p role="alert" className={authStyles.error}>{t(passkeyError)}</p>}</div>:<PinSetupForm onSave={saveDevicePin} onCancel={closePinSetup}/>}</div></DialogFrame>}

      {passkeyDeleteId && <ConfirmDialog titleId="passkey-delete-title" descriptionId="passkey-delete-description" title={t("Hapus biometrik?")} description={t("Perangkat ini tidak lagi dapat membuka FinTrack dengan biometrik tersebut.")} confirmLabel={t("Hapus")} onClose={() => { if (!passkeyBusy) setPasskeyDeleteId(null); }} onConfirm={() => void deletePasskey()} loading={passkeyBusy === "delete"} error={passkeyError} />}
    </ReferenceRoot>
  );
}

function SettingsSkeleton() { return <PageSkeleton variant="settings"/>; }
