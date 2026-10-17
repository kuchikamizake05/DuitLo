import Image from "next/image";
import styles from "./landing.module.css";
export type PreviewTab = "overview" | "wallets" | "activity" | "transactions" | "reports" | "goals";
const labels: Record<PreviewTab, [string, string]> = {
  goals: ["Target tabungan", "Savings goal"],
  overview: ["Beranda", "Home"], wallets: ["Dompet", "Wallets"],
  activity: ["Kalender aktivitas", "Activity calendar"],
  transactions: ["Daftar transaksi", "Transaction list"], reports: ["Laporan", "Reports"],
};
export default function AppPreview({ tab = "overview", english = false, hero = false }: { tab?: PreviewTab; english?: boolean; hero?: boolean }) {
  const phone = (screen: PreviewTab, secondary = false) => <Image key={screen}
    src={`/images/landing/${screen}-duitlo.webp`}
    alt={`${labels[screen][english ? 1 : 0]} — DuitLo ${english ? "in light mode" : "dalam mode light"}`}
    width={708} height={1442}
    sizes={hero ? "(max-width: 600px) 270px, 330px" : "(max-width: 600px) 280px, 320px"}
    preload={hero && !secondary}
    className={secondary ? styles.secondaryPhone : styles.primaryPhone} />;
  return <div className={hero ? styles.phonePair : styles.phoneShowcase}>
    {hero && phone("wallets", true)}{phone(tab)}
  </div>;
}
