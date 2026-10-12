"use client";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { ReferenceRoot, type ReferencePage } from "./runtime";

export function ReferenceDialog({ page, title, onClose, busy = false, children, onMenu }: { page: ReferencePage; title: string; onClose: () => void; busy?: boolean; onMenu?:()=>void; children: ReactNode }) {
  const close=()=>{if(!busy)onClose();};
  const titleId = `reference-dialog-${page}`;
  return <DialogFrame titleId={titleId} onClose={close} closeDisabled={busy} className="!items-start !bg-transparent !p-0" contentClassName="!max-h-[100svh] !h-[100svh] !w-full !max-w-none !rounded-none !border-0 !shadow-none">
    <ReferenceRoot page={page}><h2 id={titleId} className="sr-only">{title}</h2><Navbar onBack={close} onMenu={onMenu}/>{children}</ReferenceRoot>
  </DialogFrame>;
}
