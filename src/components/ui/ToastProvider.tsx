"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import styles from "./toast.module.css";
import { useLanguage } from "@/components/LanguageProvider";

type ToastTone = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { showToast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles = {
  success: { icon: Check, title: { id: "Berhasil", en: "Success" } },
  error: { icon: X, title: { id: "Belum berhasil", en: "Something went wrong" } },
  info: { icon: Info, title: { id: "Informasi", en: "Information" } },
  warning: { icon: TriangleAlert, title: { id: "Perhatian", en: "Attention" } },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t, language } = useLanguage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === "warning" ? 2500 : 4800);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className={styles.viewport}>
        {toasts.map((toast) => {
          const { icon: Icon, title } = toastStyles[toast.tone];
          return (
            <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"} className={styles.toast} data-tone={toast.tone}>
              <span className={styles.icon}><Icon aria-hidden="true" size={20} style={{strokeWidth:2}} /></span>
              <div className={styles.copy}><p className={styles.title}>{title[language]}</p><p className={styles.message}>{t(toast.message)}</p></div>
              <button type="button" onClick={() => dismiss(toast.id)} className={styles.close} aria-label={t("Tutup notifikasi")}>
                <X aria-hidden="true" size={18} style={{strokeWidth:1.75}} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
