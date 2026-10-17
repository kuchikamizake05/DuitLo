import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Archivo_Black, JetBrains_Mono, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppBoundary from "@/components/AppBoundary";
import { AppViewport } from "@/components/AppViewport";
import OnboardingBoundary from "@/components/OnboardingBoundary";
import PWARegister from "@/components/PWARegister";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import {ProfilePhotoProvider} from "@/components/ProfilePhotoProvider";
import SkipLink from "@/components/SkipLink";
import { ToastProvider } from "@/components/ui/ToastProvider";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export async function generateViewport(): Promise<Viewport> {
  const dark = (await cookies()).get("fintrack-theme")?.value === "dark";
  return {
    themeColor: dark ? "#111214" : "#f4fbf6",
    colorScheme: dark ? "dark" : "light",
    viewportFit: "cover",
  };
}

export const metadata: Metadata = {
  metadataBase: new URL("https://duitlo.vercel.app"),
  title: { default: "DuitLo — Catat Keuangan, Budget & Target Tabungan", template: "%s | DuitLo" },
  description: "Catat pemasukan dan pengeluaran, scan struk dengan AI, atur budget, dan pantau target tabungan. Kelola rekening, e-wallet, dan uang tunai bersama DuitLo.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "DuitLo",
    title: "DuitLo — Catat Keuangan, Budget & Target Tabungan",
    description: "Catat transaksi, scan struk, atur budget, dan pantau target tabungan dalam satu aplikasi keuangan pribadi.",
    images: [{ url: "/images/landing/hero-panels-duitlo.webp", alt: "Tampilan aplikasi keuangan pribadi DuitLo" }],
  },
  twitter: { card: "summary_large_image", title: "DuitLo — Keuangan Pribadi", description: "Catat transaksi, atur budget, dan pantau target tabungan.", images: ["/images/landing/hero-panels-duitlo.webp"] },
  applicationName: "DuitLo",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/fintrack-v2/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/fintrack-v2/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/fintrack-v2/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "DuitLo" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jetbrainsMono.variable} ${manrope.variable} ${archivoBlack.variable} ${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){var t=null,s=null;try{t=localStorage.getItem("fintrack-theme");s=localStorage.getItem("fintrack-theme-system")}catch(e){}var follow=s==="true"||(s!=="false"&&t!=="light"&&t!=="dark");var dark=follow?window.matchMedia("(prefers-color-scheme: dark)").matches:t==="dark";document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light"})();` }} /></head>
      <body className="flex min-h-full flex-col bg-[var(--canvas)] font-sans text-slate-900">
        <AppViewport><ThemeProvider><LanguageProvider>
          <ProfilePhotoProvider><ToastProvider>
            <PWARegister />
            <SkipLink />
            <AppBoundary><OnboardingBoundary>{children}</OnboardingBoundary></AppBoundary>
          </ToastProvider></ProfilePhotoProvider>
        </LanguageProvider></ThemeProvider></AppViewport>
      </body>
    </html>
  );
}
