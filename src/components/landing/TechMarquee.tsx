"use client";
import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./landing.module.css";
const rows = [
  ["Next.js", "React", "TypeScript", "Tailwind CSS", "Motion", "Lucide"],
  ["Supabase", "PostgreSQL", "Gemini AI", "Vercel", "Zod", "pnpm"],
];
const logos: Record<string, string> = { "Next.js": "nextdotjs", React: "react", TypeScript: "typescript", "Tailwind CSS": "tailwindcss", Motion: "motion", Lucide: "lucide", Supabase: "supabase", PostgreSQL: "postgresql", "Gemini AI": "googlegemini", Vercel: "vercel", Zod: "zod", pnpm: "pnpm" };
export default function TechMarquee() {
  const { language } = useLanguage();
  const english = language === "en";
  return <section id="tech-stack" className={styles.techSection} aria-label="DuitLo tech stack">
    <h2 className={styles.techHeading}>{english ? "Behind DuitLo." : "Di balik layar DuitLo."}</h2><p className={styles.techCaption}>{english ? "The tools behind the interface, features, and data storage." : "Teknologi yang dipakai DuitLo, dari tampilan sampai penyimpanan data."}</p>
    {rows.map((row, index) => <div key={index} className={styles.techRail} tabIndex={0}>
      <div className={styles.techTrack} data-reverse={index === 1}>
        {[0,1,2,3].map(copy => <div className={styles.techGroup} key={copy} aria-hidden={copy > 0}>
          {row.map(name => <span className={styles.techItem} key={name}><Image src={`/images/landing/tech/${logos[name]}.svg`} width={24} height={24} alt=""/>{name}</span>)}
        </div>)}
      </div>
    </div>)}
  </section>;
}



