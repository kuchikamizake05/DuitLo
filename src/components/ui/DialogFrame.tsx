"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import {useLanguage} from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

type DialogFrameProps = {
  titleId: string;
  descriptionId?: string;
  role?: "dialog" | "alertdialog";
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) =>
    element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true",
  );
}

export function DialogFrame({
  titleId,
  descriptionId,
  role = "dialog",
  initialFocusRef,
  onClose,
  closeDisabled = false,
  children,
  className,
  contentClassName,
}: DialogFrameProps) {
  const {t}=useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = getFocusableElements(dialog)[0];
      (initialFocusRef?.current ?? firstFocusable ?? dialog).focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      const openDialogs = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
      if (openDialogs.item(openDialogs.length - 1) !== dialog) return;
      if (event.key === "Escape") {
        if (!closeDisabled) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement = document.activeElement;
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) window.setTimeout(() => previouslyFocused.focus(), 0);
    };
  }, [closeDisabled, initialFocusRef]);

  const popupChrome=!contentClassName?.includes("!h-[100svh]")&&!contentClassName?.includes("!bg-transparent");
  return (
    <div
      className={cn("fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5", className)}
      onMouseDown={(event) => {
        if (!closeDisabled && event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        data-popup-chrome={popupChrome?"true":undefined}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn("relative max-h-[calc(100svh-0.75rem)] w-full overflow-y-auto rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-w-xl sm:rounded-2xl", contentClassName)}
      >
        {popupChrome&&<><div aria-hidden="true" className="flex justify-center pt-3 pb-1"><span className="h-1.5 w-10 rounded-full bg-surface-container-highest"/></div><button type="button" disabled={closeDisabled} onClick={()=>onCloseRef.current()} aria-label={t("Tutup")} className="absolute right-4 top-8 z-10 w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant disabled:opacity-50"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button></>}
        {children}
      </div>
    </div>
  );
}
