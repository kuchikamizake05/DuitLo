"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";
import {AuthShell} from "@/components/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";
import { sanitizeNextPath } from "@/lib/auth";
import {
  AUTH_SUCCESS_MESSAGES,
  buildAuthRedirectUrl,
  getAuthErrorMessage,
  type AuthAction,
  type AuthMode,
  validatePassword,
} from "@/lib/login";
import { isSupabaseConfigured, supabase } from "@/infrastructure/supabase/browser-client";
import styles from "./login.module.css";

type Feedback = { type: "success" | "error"; text: string };

function getLocationState() {
  const params = new URLSearchParams(window.location.search);
  return {
    destination: sanitizeNextPath(params.get("next")),
    updatePassword: params.get("mode") === "update-password",
  };
}

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState<AuthAction | null>(null);
  const [message, setMessage] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const location = getLocationState();
    const oauthError = new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    if (oauthError) {
      queueMicrotask(() => {
        if (active) setMessage({ type: "error", text: getAuthErrorMessage("oauth", new Error(oauthError)) });
      });
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (location.updatePassword) {
        setMode("update-password");
        return;
      }
      if (!data.session) return;
      router.replace(location.destination);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setMessage(null);
        return;
      }
      if (session && !getLocationState().updatePassword) router.replace(getLocationState().destination);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmation("");
    setMessage(null);
  };

  const handleCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured || !email) return;

    if (mode === "reset") {
      setLoading("reset");
      setMessage(null);
      try {
        const location = getLocationState();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: buildAuthRedirectUrl(window.location.origin, location.destination, "update-password"),
        });
        if (error) throw error;
        setMessage({ type: "success", text: AUTH_SUCCESS_MESSAGES.reset });
      } catch (error) {
        setMessage({ type: "error", text: getAuthErrorMessage("reset", error) });
      } finally {
        setLoading(null);
      }
      return;
    }

    const passwordError = validatePassword(password, mode === "signup" ? confirmation : undefined);
    if (passwordError) {
      setMessage({ type: "error", text: passwordError });
      return;
    }

    const action: AuthAction = mode === "signup" ? "signup" : "login";
    setLoading(action);
    setMessage(null);
    try {
      const location = getLocationState();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: buildAuthRedirectUrl(window.location.origin, location.destination) },
        });
        if (error) throw error;
        if (data.session) router.replace(location.destination);
        else setMessage({ type: "success", text: AUTH_SUCCESS_MESSAGES.signUp });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(location.destination);
      }
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(action, error) });
    } finally {
      setLoading(null);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    const passwordError = validatePassword(password, confirmation);
    if (passwordError) {
      setMessage({ type: "error", text: passwordError });
      return;
    }

    setLoading("update-password");
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: "success", text: AUTH_SUCCESS_MESSAGES.passwordUpdated });
      router.replace(getLocationState().destination);
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage("update-password", error) });
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) return;
    setLoading("oauth");
    setMessage(null);
    try {
      const location = getLocationState();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: buildAuthRedirectUrl(window.location.origin, location.destination) },
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage("oauth", error) });
      setLoading(null);
    }
  };

  const busy = loading !== null;
  const isUpdate = mode === "update-password";
  const title = t(isUpdate ? "Buat kata sandi baru" : mode === "reset" ? "Pulihkan kata sandi" : mode === "signup" ? "Buat akun DuitLo" : "Masuk ke DuitLo");
  const description = isUpdate
    ? "Gunakan minimal 8 karakter untuk melindungi akunmu."
    : mode === "reset"
      ? "Kami akan mengirim tautan pemulihan ke emailmu."
      : mode === "signup"
        ? "Daftar dengan email atau gunakan akun Google."
        : "Lanjutkan perjalanan keuanganmu.";

  return <AuthShell titleId="login-title" onBack={()=>{if(busy)return;if(mode!=="login")changeMode("login");else router.push("/");}} footer={!isUpdate && mode !== "reset" ? (
            <p className="mt-6 text-center text-xs text-slate-500">
              {t(mode === "signup" ? "Sudah punya akun?" : "Belum punya akun?")} {" "}
              <button type="button" onClick={() => changeMode(mode === "signup" ? "login" : "signup")} disabled={busy} className="font-extrabold text-emerald-700 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50">
                {t(mode === "signup" ? "Masuk" : "Daftar")}
              </button>
            </p>
          ) : null
}>
          <div className={`${styles.cardHeader} text-left`}>
            <h1 id="login-title" className={`${styles.cardTitle} `}>{title}</h1>
            <p className="mt-2.5 text-[14px] leading-5 text-slate-500 sm:mt-2 sm:text-[13px]">{t(description)}</p>
          </div>

          <form onSubmit={isUpdate ? handlePasswordUpdate : handleCredentials} className={styles.form}>
            {!isSupabaseConfigured && <p role="alert" className={styles.error}>{t("Layanan login belum tersedia. Coba lagi nanti.")}</p>}

            {!isUpdate && <EmailField value={email} onChange={setEmail} disabled={busy} />}
            {mode !== "reset" && <PasswordField id="password" label="Kata sandi" value={password} onChange={setPassword} disabled={busy} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
            {(mode === "signup" || isUpdate) && <PasswordField id="password-confirmation" label="Konfirmasi kata sandi" value={confirmation} onChange={setConfirmation} disabled={busy} autoComplete="new-password" />}

            {mode === "login"&&<button type="button" disabled={busy} onClick={()=>changeMode("reset")} className={styles.forgot}>{t("Lupa kata sandi?")}</button>}
            <button type="submit" disabled={busy || !isSupabaseConfigured || (!isUpdate && !email)} className={styles.primary}>
              {busy && loading !== "oauth" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : isUpdate ? <KeyRound className="h-4.5 w-4.5" /> : null}
              {loading && loading !== "oauth" ? t("Memproses...") : isUpdate ? t("Simpan kata sandi baru") : mode === "reset" ? t("Kirim tautan pemulihan") : mode === "signup" ? t("Buat akun") : <span>{t("Masuk")}</span>}
            </button>
          </form>

          {!isUpdate && mode !== "reset" && (
            <>
              <div className={`${styles.divider} my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400`}><span className="h-px flex-1 bg-slate-100" /><span>{t("atau lanjut dengan")}</span><span className="h-px flex-1 bg-slate-100" /></div>
              <button type="button" onClick={handleGoogle} disabled={busy || !isSupabaseConfigured} className={styles.secondary}>
                <GoogleMark /> {t(loading === "oauth" ? "Menghubungkan..." : mode === "signup" ? "Daftar dengan Google" : "Masuk dengan Google")}
              </button>
            </>
          )}


          {(mode === "reset" || isUpdate) && <button type="button" onClick={() => changeMode("login")} disabled={busy} className="mt-3 min-h-10 w-full text-sm font-bold text-slate-500 hover:text-emerald-700">{t("Kembali ke halaman masuk")}</button>}

          <div aria-live="polite" aria-atomic="true">
            {message && <div role={message.type === "error" ? "alert" : "status"} className={`flex items-start gap-3 ${message.type === "success" ? styles.success : styles.error}`}>{message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <Mail className="mt-0.5 h-4.5 w-4.5 shrink-0" />}<p>{t(message.text)}</p></div>}
          </div>

          <div className={`${styles.privacyNote} mt-5 flex items-start gap-2.5 border-t border-slate-100 pt-4`}><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><p className="text-[11px] leading-[17px] text-slate-500">{t("Hanya kamu yang dapat mengakses catatan keuanganmu.")}</p></div>
  </AuthShell>;
}

const inputStyles = "min-h-12 w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function EmailField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { t } = useLanguage();
  return (
    <div>
      <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">{t("Alamat email")}</label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder={t("Masukkan email")} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={`${inputStyles} pr-3.5`} />
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoComplete: "current-password" | "new-password";
};

function PasswordField({ id, label, value, onChange, disabled, autoComplete }: PasswordFieldProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-bold text-slate-700">{t(label)}</label>
      </div>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} placeholder={t(id === "password-confirmation" ? "Ulangi kata sandi" : "Masukkan kata sandi")} minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} className={`${inputStyles} pr-11`} />
        <button type="button" onClick={() => setVisible((current) => !current)} disabled={disabled} aria-label={t(visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi")} aria-pressed={visible} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z" /><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" /><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6 12 6.01Z" /></svg>;
}
