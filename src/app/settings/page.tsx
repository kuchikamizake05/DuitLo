"use client";
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
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkSnapshot, getServerNetworkSnapshot);
  const [standalone, setStandalone] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        if (navigator.onLine) router.push("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setUserName(session.user.user_metadata?.full_name??session.user.email?.split("@")[0]??"FinTrack");
      setUserId(session.user.id);
      const { data, error } = await supabase.auth.passkey.list();
      if (!error) {
        setPasskeys(data ?? []);
        setDeviceLockEnabled(Boolean((data?.length ?? 0) && readPasskeyDeviceState(session.user.id)?.enabled));
      }
      setLoading(false);
    };
    void fetchUser();
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
    setPasskeys(data ?? []);
    return data ?? [];
  }

  async function enrollPasskey() {
    if (!userId || passkeyBusy || !isWebAuthnSupported()) return;
    setPasskeyBusy("enroll");
    setPasskeyError(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      const nextPasskeys = await refreshPasskeys();
      if (nextPasskeys.length) {
        writePasskeyDeviceState({ userId, emailHint: maskPasskeyEmail(userEmail), enabled: true, locked: false });
        setDeviceLockEnabled(true);
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
    if (!userId || !passkeys.length) return;
    setDeviceLockEnabled(enabled);
    if (!enabled) {
      clearPasskeyDeviceState(userId);
      return;
    }
    writePasskeyDeviceState({ userId, emailHint: maskPasskeyEmail(userEmail), enabled: true, locked: false });
  }

  function lockNow() {
    if (!userId || !deviceLockEnabled || !passkeys.length) return;
    writePasskeyDeviceState({ userId, emailHint: maskPasskeyEmail(userEmail), enabled: true, locked: true });
  }

  return (
    <ReferenceRoot page="pengaturan">
      <Navbar />
      {loading?<main className="pt-20 px-margin" aria-busy="true"><SettingsSkeleton/></main>:<SettingsView email={userEmail} name={userName} online={online} biometric={deviceLockEnabled} biometricAvailable={passkeys.length>0&&isWebAuthnSupported()} onBiometric={toggleDeviceLock} onEnroll={()=>void enrollPasskey()} onLock={lockNow} onLogout={()=>void handleLogout()} loggingOut={loggingOut} passkeys={passkeys} onDeletePasskey={setPasskeyDeleteId} error={passkeyError??logoutError}/>}

      {passkeyDeleteId && <ConfirmDialog titleId="passkey-delete-title" descriptionId="passkey-delete-description" title={t("Hapus Passkey?")} description={t("Perangkat ini tidak lagi dapat membuka FinTrack dengan Passkey tersebut.")} confirmLabel={t("Hapus")} onClose={() => { if (!passkeyBusy) setPasskeyDeleteId(null); }} onConfirm={() => void deletePasskey()} loading={passkeyBusy === "delete"} error={passkeyError} />}
    </ReferenceRoot>
  );
}

function SettingsSkeleton() { return <PageSkeleton variant="settings"/>; }
