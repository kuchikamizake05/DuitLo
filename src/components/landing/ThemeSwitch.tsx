"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./landing.module.css";

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const dark = theme === "dark";
  return <button type="button" role="switch" aria-checked={dark}
    aria-label={language === "en" ? "Dark mode" : "Mode gelap"}
    className={`${styles.themeSwitch} ${className}`} onClick={() => setTheme(dark ? "light" : "dark")}>
    <span aria-hidden="true" className={styles.themeTrack}>
      <span className={styles.themeThumb}/>
      <span className={`${styles.themeIcon} ${styles.themeSun}`}><Sun size={18} strokeWidth={1.75} style={{strokeWidth:1.75}}/></span>
      <span className={`${styles.themeIcon} ${styles.themeMoon}`}><Moon size={18} strokeWidth={1.75} style={{strokeWidth:1.75}}/></span>
    </span>
  </button>;
}
