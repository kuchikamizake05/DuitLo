"use client";

import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";
import DataPolicyLayout from "@/components/DataPolicyLayout";
export default function SupportPage() {
  const { language } = useLanguage();
  const id = language === "id";
  return <DataPolicyLayout title={id ? "Dukungan FinTrack" : "FinTrack support"}>
    <p>{id ? "Jika mengalami masalah dengan catatan, pembayaran, ekspor, atau penghapusan akun, kirim permintaan setelah masuk akun. Permintaan dicatat untuk ditinjau dan statusnya ditampilkan di akunmu. Mengirim permintaan tidak langsung menyelesaikan penghapusan atau menjamin waktu tanggapan." : "For a problem with your records, a payment, an export, or account deletion, submit a request while signed in. Requests are recorded for review and their status appears in your account. Submitting a request does not complete a deletion or guarantee a response time."}</p>
    <p><Link href="/data-controls" className="inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-on-primary">{id ? "Buka permintaan" : "Open requests"}</Link></p>
    <h2>{id ? "Sebelum mengirim permintaan" : "Before submitting"}</h2><p>{id ? "Sertakan halaman terkait, hasil yang diharapkan, hal yang terjadi, dan perkiraan waktunya. Jangan sertakan kata sandi, PIN, detail lengkap kartu, atau gambar struk pribadi. Untuk pertanyaan pembayaran, sertakan referensi pembayaran jika tersedia." : "Include the page, what you expected, what happened, and an approximate time. Do not include passwords, PINs, complete card details, or private receipt images. For payment questions, include the checkout reference if available."}</p>
    <h2>{id ? "Tidak bisa masuk?" : "Cannot sign in?"}</h2><p>{id ? "Gunakan " : "Use "}<Link href="/login">{id ? "halaman masuk" : "sign in"}</Link>{id ? " dan opsi pemulihan kata sandi. Permintaan memerlukan sesi terverifikasi; penghapusan akun tidak dilakukan melalui pesan publik tanpa autentikasi. Aplikasi ini belum memiliki alamat dukungan publik terpisah." : " and its password recovery option. Requests require a verified session; account deletion is not performed from an unauthenticated public message. No separate public support address is configured in this app."}</p>
  </DataPolicyLayout>;
}
