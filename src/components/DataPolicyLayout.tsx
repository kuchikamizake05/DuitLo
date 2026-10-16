import Link from "next/link";
export default function DataPolicyLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return <main id="main-content" tabIndex={-1} className="mx-auto min-h-screen max-w-3xl space-y-6 px-6 py-12 text-on-surface outline-none"><Link href="/" className="text-lg font-semibold">FinTrack</Link><h1 className="text-3xl font-bold">{title}</h1><div className="space-y-5 text-sm leading-7 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:underline">{children}</div><nav aria-label="Policy links" className="flex flex-wrap gap-5 border-t border-outline-variant pt-5 text-sm"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><Link href="/data-controls">Data requests</Link></nav></main>;
}
