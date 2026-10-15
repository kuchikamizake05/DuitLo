"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { useOnboarding } from "@/components/OnboardingBoundary";
import styles from "./onboarding.module.css";

const slides = [
  { title:"Selamat datang di FinTrack", description:"Kenali fitur FinTrack sebentar. Setelah itu, mulai dari satu dompet dan satu transaksi sesuai kebutuhanmu.", image:null, name:"Selamat datang" },
  { title:"Semua keuanganmu, satu ringkasan", description:"Satukan rekening bank, e-wallet, dan uang tunai. Setiap akun punya saldo dan riwayatnya sendiri.", image:"crossed-v2", name:"Beranda" },
  { title:"Catat dengan caramu", description:"Isi transaksi manual atau baca struk dari kamera dan galeri. Periksa detailnya sebelum menyimpan.", image:"trio-v2", name:"Aktivitas" },
  { title:"Beri arah pada uangmu", description:"Atur batas pengeluaran dengan anggaran, lalu buat target tabungan untuk hal yang ingin kamu wujudkan.", image:"fan-v2", name:"Anggaran & Target" },
  { title:"Sekarang giliranmu", description:"Masuk ke Beranda untuk mulai mencatat. Panduan di aplikasi akan membantumu menambahkan dompet dan transaksi pertama.", image:null, name:"Siap mulai" },
] as const;

export default function OnboardingPage() {
  const { t } = useLanguage();
  const onboarding = useOnboarding();
  const router = useRouter();
  const [index,setIndex] = useState(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("restart")!=="1") return;
    const userId=onboarding.userId;
    localStorage.removeItem(`fintrack:onboarding:v1:${userId}`);
    localStorage.removeItem(`fintrack:click-guide:${userId}`);
    for (const suffix of ["",":mode",":status",":practice"]) localStorage.removeItem(`fintrack:menu-guide:${userId}${suffix}`);
    router.replace("/onboarding");
  }, [onboarding.userId,router]);

  const heading = useRef<HTMLHeadingElement>(null);
  const feature = slides[index];
  const titleWords = t(feature.title).split(" ");
  const accentStart = index===0 ? titleWords.length-1 : Math.max(0,titleWords.length-2);
  const titlePunctuation = index===0 || index===slides.length-1 ? "!" : ".";
  useEffect(() => { if(index>0)heading.current?.focus(); }, [index]);

  function finish() {
    onboarding.saveProgress({
      ...(onboarding.progress ?? { version:1 as const, userId:onboarding.userId, intent:null, accountId:null, accountName:null, transactionId:null }),
      step:"summary", completedAt:new Date().toISOString(), deferredUntil:null,
    });
    router.push("/dashboard");
  }

  return <div className={`${styles.introPage} ${styles.introMockupPage}`}>
    <header className={styles.introHeader}><span className={styles.introBrand}><BrandLogo size={28} priority/>FinTrack</span><div className={styles.introHeaderActions}>{index>0&&<button type="button" className={styles.introBack} aria-label={t("Sebelumnya")} onClick={()=>setIndex(index-1)}><ArrowLeft size={20} aria-hidden="true"/></button>}<LanguageSwitcher compact/></div></header>
    <main id="main-content" tabIndex={-1} className={styles.introMain}>
      <figure className={feature.image ? styles.introPreview : styles.introWelcome}>
        {feature.image ? <>
        <Image key={feature.image} src={`/onboarding/${feature.image}.png`} alt={t("Preview fitur {feature}",{feature:t(feature.name)})} width={1024} height={1536} sizes="(min-width: 900px) 432px, 90vw" className={`${styles.introPhone} ${index===1 ? styles.introPhoneFirst : index===2 ? styles.introPhoneSecond : styles.introPhoneThird}`} priority={index===0}/>
        </> : <>
          <svg className={styles.introAmbient} viewBox="0 0 440 420" fill="none" aria-hidden="true" focusable="false">
            {index===0 ? <>
              <path d="M35 72C48 41 91 34 113 53" stroke="#80ac93" strokeWidth="2" strokeLinecap="round"/>
              <path d="M48 75C58 54 84 48 100 58" stroke="#a0c5ad" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M343 42L348 54L361 59L348 64L343 77L338 64L325 59L338 54Z" fill="#e6bf68"/>
              <circle cx="302" cy="32" r="4" fill="#a79bd2"/>
              <rect x="28" y="331" width="13" height="13" rx="4" transform="rotate(-20 28 331)" fill="#b0a1d8"/>
              <path d="M330 361C352 344 384 353 393 374" stroke="#8db69c" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="89" cy="377" r="6" stroke="#a0bea9" strokeWidth="2"/>
              <path d="M213 390V400M208 395H218" stroke="#bfaa76" strokeWidth="2" strokeLinecap="round"/>
            </> : <>
              <path d="M49 43L54 55L67 60L54 65L49 78L44 65L31 60L44 55Z" fill="#b1a2d8"/>
              <path d="M306 41C326 21 355 25 370 46" stroke="#86b197" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="385" cy="96" r="7" stroke="#dabd77" strokeWidth="2"/>
              <path d="M54 348L63 340M120 385L123 373M327 389L333 377M381 327L391 332" stroke="#b09bcf" strokeWidth="4" strokeLinecap="round"/>
              <path d="M189 39L194 49L205 51L197 59L198 70L189 65L179 70L181 59L173 51L184 49Z" fill="#eccb83"/>
              <path d="M41 287C25 298 24 318 37 331" stroke="#8db69c" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="238" cy="395" r="5" fill="#96b9a0"/>
            </>}
          </svg>
          <svg className={styles.introBackdrop} viewBox="0 0 440 360" fill="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="intro-backdrop" x1="220" y1="32" x2="220" y2="328" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--intro-art-deep)"/>
                <stop offset="1" stopColor="var(--intro-art-light)" stopOpacity="0.2"/>
              </linearGradient>
            </defs>
            {index===0 ? <>
              <circle cx="63" cy="92" r="13" fill="#f3ce76"/>
              <circle cx="378" cy="234" r="10" fill="#aa9fdb"/>
              <path d="M347 66V90M335 78H359" stroke="#739c81" strokeWidth="4" strokeLinecap="round"/>
              <path d="M44 230C28 202 32 165 52 148M352 295C380 280 395 255 397 228" stroke="#7fab91" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="95" cy="284" r="4" fill="#739c81"/>
              <circle cx="387" cy="124" r="5" fill="#f3ce76"/>
            </> : <>
              <path d="M52 74L59 88M111 38L107 53M362 69L349 78M390 157L403 154M76 283L66 293M361 289L370 303" stroke="#d9af55" strokeWidth="5" strokeLinecap="round"/>
              <path d="M75 146L81 158L94 160L84 169L86 182L75 176L64 182L66 169L56 160L69 158Z" fill="#b2a5e4"/>
              <path d="M365 221L371 233L384 235L374 244L376 257L365 251L354 257L356 244L346 235L359 233Z" fill="#f3ce76"/>
              <circle cx="153" cy="48" r="5" fill="#a293d2"/>
              <circle cx="310" cy="316" r="6" fill="#739c81"/>
              <path d="M319 46C334 32 352 35 357 48" stroke="#8ab89a" strokeWidth="2" strokeLinecap="round"/>
            </>}
          </svg>
          <Image key={index===0 ? "welcome" : "enjoy"} src={`/onboarding/duo-${index===0 ? "welcome" : "enjoy"}.png`} alt="" width={1536} height={1024} sizes="(min-width: 900px) 432px, 90vw" className={styles.introDuo} priority={index===0}/></>}
      </figure>
      <section className={styles.introCard}>
      <div className={styles.introNavigation}>
        <div className={styles.introDots} aria-label={t("Pilih preview fitur")}>{slides.map((item,position)=><button key={item.name} type="button" aria-label={t(item.name)} aria-pressed={position===index} onClick={()=>setIndex(position)}><span/></button>)}</div>
        <div className={styles.introCopy}>
          <h1 ref={heading} tabIndex={-1}>{titleWords.slice(0,accentStart).join(" ")} <span className={styles.introTitleAccent}>{titleWords.slice(accentStart).join(" ")}{titlePunctuation}</span></h1>
          <p>{t(feature.description)}</p>
        </div>
        <div className={styles.introActions}>
          <button type="button" className={styles.introSkip} onClick={finish}>{t("Lewati")}</button>
          <button type="button" className={styles.introNext} aria-label={t(index===slides.length-1?"Mulai pakai FinTrack":"Lanjut")} onClick={()=>index===slides.length-1?finish():setIndex(index+1)}><ArrowRight size={24} aria-hidden="true"/></button>
        </div>
      </div>
      </section>
    </main>
  </div>;
}
