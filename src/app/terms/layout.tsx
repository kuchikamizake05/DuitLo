import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ketentuan Penggunaan",
  description: "Baca ketentuan penggunaan aplikasi keuangan pribadi DuitLo dan tanggung jawab pengguna.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) { return children; }
