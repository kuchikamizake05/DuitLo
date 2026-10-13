"use client";
import type {ReactNode} from "react";
import {ArrowLeft} from "lucide-react";
import BrandLockup from "@/components/BrandLockup";
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {useLanguage} from "@/components/LanguageProvider";
import styles from "@/app/login/login.module.css";
export function AuthShell({children,titleId,variant="account",onBack,footer}:{children:ReactNode;titleId:string;variant?:"account"|"unlock"|"welcome";onBack?:()=>void;footer?:ReactNode}){
 const {t}=useLanguage();
 return <div className={`${styles.page} ${styles[variant]}`}><header className={styles.header}><div className={styles.headerSide}>{onBack&&<button type="button" className={styles.back} onClick={onBack} aria-label={t("Kembali")}><ArrowLeft size={20}/></button>}</div><BrandLockup href="/" priority ariaLabel="FinTrack beranda"/><div className={styles.headerSide}><LanguageSwitcher compact/></div></header><main id="main-content" tabIndex={-1} className={styles.main}><section className={styles.card} aria-labelledby={titleId}>{children}</section>{footer&&<footer className={styles.footer}>{footer}</footer>}</main></div>;
}
