"use client";
import {AuthShell} from "@/components/AuthShell";
import {useLanguage} from "@/components/LanguageProvider";
import styles from "@/app/login/login.module.css";
export function AuthWelcome({onLogin,onSignup}:{onLogin:()=>void;onSignup:()=>void}){
 const {t}=useLanguage();
 return <AuthShell titleId="welcome-title" variant="welcome" footer={<p>{t("Keuanganmu, dalam kendalimu.")}</p>}>
  <div className={styles.welcomeArt} aria-hidden="true"><svg viewBox="0 0 320 260" fill="none"><circle cx="160" cy="130" r="108" fill="var(--auth-primary)" opacity=".45"/><rect x="60" y="48" width="194" height="162" rx="24" fill="var(--surface)" transform="rotate(-8 60 48)"/><path d="M83 168L124 136L158 145L211 93" stroke="var(--auth-link)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/><path d="M188 92L213 90L211 115" stroke="var(--auth-link)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/><rect x="147" y="151" width="134" height="84" rx="20" fill="var(--auth-link)"/><rect x="232" y="171" width="59" height="42" rx="12" fill="var(--auth-primary)"/><circle cx="251" cy="192" r="5" fill="var(--auth-on-primary)"/><circle cx="57" cy="187" r="30" fill="var(--auth-primary)"/><path d="M49 188H64M54 179L49 188L55 196M64 180H54" stroke="var(--auth-link)" strokeWidth="3" strokeLinecap="round"/><path d="M270 51V68M262 59H279M33 84V96M27 90H39" stroke="var(--auth-link)" strokeWidth="3" strokeLinecap="round"/><circle cx="295" cy="130" r="5" fill="var(--auth-link)"/><circle cx="28" cy="141" r="4" fill="var(--auth-link)"/></svg></div>
  <h1 id="welcome-title" className={styles.cardTitle}>{t("Hai, Selamat Datang!")}</h1><p className="mt-2 text-sm text-[var(--ink-soft)]">{t("Kelola keuanganmu dengan lebih tenang.")}</p>
  <div className={styles.welcomeActions}><button type="button" className={styles.primary} onClick={onLogin}>{t("Masuk")}</button><button type="button" className={styles.secondary} onClick={onSignup}>{t("Buat akun")}</button></div>
 </AuthShell>;
}
