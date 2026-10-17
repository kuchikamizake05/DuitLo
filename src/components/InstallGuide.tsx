"use client";

import { useState } from "react";
import { ChevronDown, Download, Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { Button } from "@/components/ui/Button";
import styles from "./install-guide.module.css";

type Platform = "ios" | "android" | "windows" | "mac";

export function InstallGuide({ onClose, canInstall, onInstall }: {
  onClose: () => void;
  canInstall: boolean;
  onInstall: () => void;
}) {
  const { language } = useLanguage();
  const c = (id: string, en: string) => language === "en" ? en : id;
  const [open, setOpen] = useState<Platform | null>(() => {
    const agent = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/.test(agent)) return "android";
    if (/Macintosh|Mac OS/.test(agent)) return "mac";
    return "windows";
  });
  const [installed] = useState(() => window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const platforms = [
    { id: "ios" as const, title: "iOS (iPhone / iPad) — Safari", icon: Tablet, steps: [
      c("Buka DuitLo di Safari.", "Open DuitLo in Safari."),
      c("Ketuk Bagikan (kotak dengan panah ke atas).", "Tap Share (the square with an upward arrow)."),
      c('Pilih “Tambahkan ke Layar Utama” (Add to Home Screen). Jika belum terlihat, cari di Edit Tindakan.', 'Choose “Add to Home Screen”. If it is missing, look in Edit Actions.'),
      c('Aktifkan “Buka sebagai App Web” jika tersedia, lalu ketuk “Tambah”.', 'Enable “Open as Web App” if available, then tap “Add”.'),
      c("Buka DuitLo dari ikon di layar utama.", "Open DuitLo from its Home Screen icon."),
    ] },
    { id: "android" as const, title: "Android — Chrome", icon: Smartphone, steps: [
      c("Buka DuitLo di Chrome.", "Open DuitLo in Chrome."),
      c('Ketuk menu tiga titik, lalu pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.', 'Tap the three-dot menu and choose “Install app” or “Add to Home screen”.'),
      c("Ikuti konfirmasi browser, lalu buka DuitLo dari layar utama atau daftar aplikasi.", "Follow the browser confirmation, then open DuitLo from your Home screen or app list."),
    ] },
    { id: "windows" as const, title: "Windows — Chrome / Edge", icon: Monitor, steps: [
      c("Buka DuitLo di Chrome atau Edge.", "Open DuitLo in Chrome or Edge."),
      c('Klik ikon instal di bilah alamat jika tersedia. Di Chrome, kamu juga bisa membuka menu → Cast, simpan, dan bagikan → Instal halaman sebagai aplikasi. Di Edge, buka menu → Aplikasi → Instal situs ini sebagai aplikasi.', 'Click the install icon in the address bar if available. In Chrome, you can also use Menu → Cast, save, and share → Install page as app. In Edge, use Menu → Apps → Install this site as an app.'),
      c("Konfirmasi instalasi, lalu buka DuitLo dari menu Start.", "Confirm installation, then open DuitLo from the Start menu."),
    ] },
    { id: "mac" as const, title: "Mac — Chrome / Safari", icon: Laptop, steps: [
      c("Buka DuitLo di Safari atau Chrome.", "Open DuitLo in Safari or Chrome."),
      c('Di Safari pada macOS Sonoma atau lebih baru, pilih File → Tambahkan ke Dock. Di Chrome, gunakan ikon instal atau menu → Cast, simpan, dan bagikan → Instal halaman sebagai aplikasi.', 'In Safari on macOS Sonoma or later, choose File → Add to Dock. In Chrome, use the install icon or Menu → Cast, save, and share → Install page as app.'),
      c("Konfirmasi nama DuitLo, lalu buka dari Dock atau daftar aplikasi.", "Confirm the DuitLo name, then open it from the Dock or app list."),
    ] },
  ];

  return <DialogFrame titleId="install-guide-title" descriptionId="install-guide-description" onClose={onClose} className="pointer-events-auto" contentClassName={styles.dialog}>
    <div className={styles.content}>
      <h2 id="install-guide-title" className={styles.title}><Download size={22} strokeWidth={1.75} aria-hidden="true" />{c("Instal DuitLo", "Install DuitLo")}</h2>
      <p id="install-guide-description" className={styles.description}>{c("Pasang DuitLo di perangkatmu untuk akses langsung seperti aplikasi. Buka alamat ini di browser:", "Install DuitLo on your device for direct access like an app. Open this address in your browser:")} <span className={styles.address}>{window.location.origin}</span></p>
      {installed ? <p className={styles.notice}>{c("DuitLo sudah dibuka sebagai aplikasi di perangkat ini.", "DuitLo is already running as an app on this device.")}</p> : canInstall && <Button className="mb-4 w-full" onClick={onInstall}><Download size={17} aria-hidden="true" />{c("Instal sekarang", "Install now")}</Button>}
      <div className={styles.platforms}>{platforms.map(({ id, title, icon: Icon, steps }) => <section className={styles.platform} key={id}>
        <h3><button type="button" className={styles.toggle} aria-expanded={open === id} aria-controls={`install-${id}`} onClick={() => setOpen(open === id ? null : id)}><Icon size={19} strokeWidth={1.75} aria-hidden="true" /><span>{title}</span><ChevronDown size={18} className={open === id ? styles.expanded : undefined} aria-hidden="true" /></button></h3>
        <ol id={`install-${id}`} hidden={open !== id} className={styles.steps}>{steps.map((step, index) => <li key={index}><span className={styles.number} aria-hidden="true">{index + 1}</span><span>{step}</span></li>)}</ol>
      </section>)}</div>
      <p className={styles.footnote}>{c("Nama menu bisa berbeda sesuai versi browser. Jika opsi instal belum tersedia, kamu tetap bisa memakai DuitLo di browser.", "Menu names may vary by browser version. If installation is unavailable, you can keep using DuitLo in your browser.")}</p>
    </div>
  </DialogFrame>;
}
