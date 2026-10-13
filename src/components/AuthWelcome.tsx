"use client";
import Image from "next/image";
import {AuthShell} from "@/components/AuthShell";
import {useLanguage} from "@/components/LanguageProvider";
import styles from "@/app/login/login.module.css";
export function AuthWelcome({onLogin,onSignup}:{onLogin:()=>void;onSignup:()=>void}){
 const {t}=useLanguage();
 return <AuthShell titleId="welcome-title" variant="welcome" footer={<p>{t("Keuanganmu, dalam kendalimu.")}</p>}>
  <div className={styles.welcomeArt} aria-hidden="true"><Image src="/auth/welcome-illustration-light.png" alt="" width={1448} height={1086} sizes="(max-width:480px) calc(100vw - 48px), 392px" loading="eager" className={styles.welcomeLight} data-welcome-theme="light"/><Image src="/auth/welcome-illustration-dark.png" alt="" width={1448} height={1086} sizes="(max-width:480px) calc(100vw - 48px), 392px" loading="eager" className={styles.welcomeDark} data-welcome-theme="dark"/></div>
  <h1 id="welcome-title" className={styles.cardTitle}>{t("Hai, Selamat Datang!")}</h1><p className="mt-2 text-sm text-[var(--ink-soft)]">{t("Kelola keuanganmu dengan lebih tenang.")}</p>
  <div className={styles.welcomeActions}><button type="button" className={styles.primary} onClick={onLogin}>{t("Masuk")}</button><button type="button" className={styles.secondary} onClick={onSignup}>{t("Buat akun")}</button></div>
 </AuthShell>;
}
