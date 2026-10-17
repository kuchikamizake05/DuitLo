"use client";
import Image from "next/image";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ReceiptPhotoControls } from "@/components/ReceiptPhotoControls";
import DemoTransactionForm from "./DemoTransactionForm";
import BrandLockup from "@/components/BrandLockup";
import type { ReferenceTransactionForm } from "@/components/reference/TransactionEditor";

import styles from "./landing.module.css";

export default function ReceiptDemo({ english }: { english: boolean }) {
  const [stage, setStage] = useState<"idle" | "capture" | "scan" | "ready" | "review" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const delays = { idle: 1600, capture: 700, scan: 1800, ready: 5000, review: 5000, done: 2500 };
    timer.current = setTimeout(() => setStage(stage === "idle" ? "capture" : stage === "capture" ? "scan" : stage === "scan" ? "ready" : stage === "ready" || stage === "review" ? "done" : "idle"), delays[stage]);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [stage]);
  const [form, setForm] = useState<ReferenceTransactionForm>({ type: "expense", amount: "50000", merchant: "DuitLo Coffee", accountId: "demo", category: "Makanan", date: "2026-10-14", note: "Flat white, croissant" });
  const c = (id: string, en: string) => english ? en : id;
  const scan = () => setStage("capture");
  return <><div className={styles.receiptStage}>
    <Image className={styles.realReceiptPhoto} src="/images/landing/coffee-receipt-duitlo.webp" width={754} height={1286} sizes="265px" alt="Struk DuitLo Coffee, total Rp50.000" /><div className={styles.receiptPhone}>
      <svg viewBox="0 0 300 610" className={styles.receiptPhoneFrame} aria-hidden="true"><rect x="3" y="3" width="294" height="604" rx="48" fill="#151716" stroke="#90958f" strokeWidth="3"/><rect x="11" y="11" width="278" height="588" rx="40" fill="#f3faf5"/><rect x="104" y="21" width="92" height="25" rx="15" fill="#101210"/><rect x="107" y="580" width="86" height="4" rx="2" fill="#142f25"/></svg>
      <div className={styles.receiptPhoneStatus} aria-hidden="true"><span>9:41</span><span>▮▮▮  ◔  ▰</span></div><div className={styles.receiptPhoneContent}><div className={styles.receiptPhoneHeader}><BrandLockup href="/" compact/><span className={styles.demoBadge}>DEMO</span></div><div className={styles.receiptCameraView}><span className={styles.cameraHint}>{c("Posisikan struk dalam bingkai", "Place receipt within frame")}</span><span className={styles.cameraFocus} aria-hidden="true"/><Image className={styles.cameraReceiptPhoto} src="/images/landing/coffee-receipt-duitlo.webp" width={754} height={1286} sizes="150px" alt={c("Foto struk DuitLo Coffee", "DuitLo Coffee receipt photo")} />{stage === "capture" && <span className={styles.captureFlash}/>}</div>
      {stage === "done" && <div role="status" className={styles.receiptSavedAlert}><span>{c("Transaksi berhasil disimpan", "Transaction saved successfully")}</span><Check size={14} aria-hidden="true" style={{strokeWidth:1.75}}/></div>}<div className={styles.receiptPhotoSheet}><span className={styles.sheetHandle}/><h3>{c("Foto struk", "Receipt photo")}</h3><p>{c("Pilih kamera atau galeri untuk membaca struk.", "Choose camera or gallery to read a receipt.")}</p>
      {(stage === "ready" || stage === "review" || stage === "done") ? <DemoTransactionForm form={form} onChange={setForm} onDone={()=>setStage("done")} english={english}/> : <ReceiptPhotoControls busy={stage === "capture" || stage === "scan"} onCamera={scan} onGallery={scan} cameraLabel={c("Kamera","Camera")} galleryLabel={c("Galeri","Gallery")} loadingLabel={stage === "capture" ? c("Mengambil foto...","Taking photo...") : c("Membaca struk...","Reading receipt...")}/>}
      </div></div>
    </div>  </div>  
  </>;
}













