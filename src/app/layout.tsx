import type { Metadata, Viewport } from "next";
import { Archivo_Black, JetBrains_Mono, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppBoundary from "@/components/AppBoundary";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
    { media: "(prefers-color-scheme: light)", color: "#f4fbf6" },
  ],
  colorScheme: "light",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FinTrack - Personal Finance Dashboard",
  description: "Pantau arus kas, investasi, dan trading dalam satu ruang keuangan pribadi yang tenang.",
  applicationName: "FinTrack",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FinTrack" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jetbrainsMono.variable} ${manrope.variable} ${archivoBlack.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--canvas)] font-sans text-slate-900">
        <ThemeProvider><LanguageProvider>
          <ProfilePhotoProvider><ToastProvider>
            <PWARegister />
            <SkipLink />
            <AppBoundary><OnboardingBoundary>{children}</OnboardingBoundary></AppBoundary>
          </ToastProvider></ProfilePhotoProvider>
        </LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
