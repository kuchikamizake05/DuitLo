"use client";
import Image from "next/image";
import type {ReactNode} from "react";
import {ArrowLeft} from "lucide-react";
import BrandLockup from "@/components/BrandLockup";
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {useLanguage} from "@/components/LanguageProvider";
import styles from "@/app/login/login.module.css";
export function AuthShell({children,titleId,variant="account",onBack,footer}:{children:ReactNode;titleId:string;variant?:"account"|"unlock"|"welcome";onBack?:()=>void;footer?:ReactNode}){
 const {t}=useLanguage();
 const header=<header className={styles.header}><div className={styles.headerSide}>{onBack&&<button type="button" className={styles.back} onClick={onBack} aria-label={t("Kembali")}><ArrowLeft size={20}/></button>}</div><BrandLockup href="/" priority ariaLabel="DuitLo beranda"/><div className={styles.headerSide}><LanguageSwitcher compact className={styles.languageSwitch}/></div></header>;
 return <div className={`${styles.page} ${styles[variant]}`}>{variant==="account"?<div className={styles.accountBackdrop}><div className={styles.accountIllustration} aria-hidden="true"><Image src="/auth/login-light-transparent.png" alt="" width={1448} height={1086} sizes="(max-width:480px) 100vw, 480px" loading="eager" className={styles.welcomeLight} data-login-theme="light"/><Image src="/auth/login-dark-transparent.png" alt="" width={1448} height={1086} sizes="(max-width:480px) 100vw, 480px" loading="eager" className={styles.welcomeDark} data-login-theme="dark"/></div>{header}</div>:header}<main id="main-content" tabIndex={-1} className={styles.main}><section className={styles.card} aria-labelledby={titleId}>{children}</section>{footer&&<footer className={styles.footer}>{footer}</footer>}</main></div>;
}
