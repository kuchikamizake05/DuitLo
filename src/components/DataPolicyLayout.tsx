"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import { ReferenceRoot } from "@/components/reference/runtime";
export default function DataPolicyLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const { language } = useLanguage();
  const id = language === "id";
  return <ReferenceRoot page="detail" contents><Navbar onBack={() => router.push("/settings")} /><main id="main-content" tabIndex={-1} className="mx-auto min-h-screen max-w-3xl space-y-6 px-6 pb-12 pt-24 text-on-surface outline-none"><h1 className="text-3xl font-bold">{title}</h1><div className="space-y-5 text-sm leading-7 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:underline">{children}</div><nav aria-label={id ? "Tautan kebijakan" : "Policy links"} className="flex flex-wrap gap-5 border-t border-outline-variant pt-5 text-sm"><Link href="/privacy">{id ? "Privasi" : "Privacy"}</Link><Link href="/terms">{id ? "Ketentuan" : "Terms"}</Link><Link href="/support">{id ? "Dukungan" : "Support"}</Link><Link href="/data-controls">{id ? "Permintaan data" : "Data requests"}</Link></nav></main></ReferenceRoot>;
}
