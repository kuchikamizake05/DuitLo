"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { Symbol } from "./runtime";

type Props = {
  icon: "account_balance_wallet" | "receipt_long" | "savings" | "pie_chart";
  title: string;
  description: string;
  action: string;
  href?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, description, action, href, onAction }: Props) {
  const { t } = useLanguage();
  const actionClass = "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-3 text-body-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
  return <section className="ft-empty-state flex flex-col items-start gap-4 rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-md">
    <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-secondary-container text-primary"><Symbol className="text-[26px]">{icon}</Symbol></span>
    <div className="space-y-2">
      <h2 className="text-headline-sm font-bold text-on-surface">{t(title)}</h2>
      <p className="max-w-lg text-body-sm leading-6 text-on-surface-variant">{t(description)}</p>
    </div>
    {href ? <Link className={actionClass} href={href}>{t(action)}</Link> : <button type="button" data-guide={action === "Tambah Dompet" ? "add-wallet" : undefined} className={actionClass} onClick={onAction}>{t(action)}</button>}
  </section>;
}
