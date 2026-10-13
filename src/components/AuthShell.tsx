"use client";
import type {ReactNode} from "react";
import BrandLockup from "@/components/BrandLockup";
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import styles from "@/app/login/login.module.css";
export function AuthShell({children,titleId}:{children:ReactNode;titleId:string}){
 return <div className={styles.page}><header className={styles.header}><BrandLockup href="/" priority ariaLabel="FinTrack beranda"/><LanguageSwitcher compact/></header><main id="main-content" tabIndex={-1} className={styles.main}><section className={styles.card} aria-labelledby={titleId}>{children}</section></main></div>;
}
