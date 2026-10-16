import Link from "next/link";
import DataPolicyLayout from "@/components/DataPolicyLayout";
export default function SupportPage() {
  return <DataPolicyLayout title="FinTrack support">
    <p>For a problem with your records, a payment, an export, or account deletion, submit a request while signed in. Requests are recorded for review and their status appears in your account. Submitting a request does not complete a deletion or guarantee a response time.</p>
    <p><Link href="/data-controls" className="inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-on-primary">Open requests</Link></p>
    <h2>Before submitting</h2><p>Include the page, what you expected, what happened, and an approximate time. Do not include passwords, PINs, complete card details, or private receipt images. For payment questions, include the checkout reference if available.</p>
    <h2>Cannot sign in?</h2><p>Use <Link href="/login">sign in</Link> and its password recovery option. Requests require a verified session; account deletion is not performed from an unauthenticated public message. No separate public support address is configured in this app.</p>
  </DataPolicyLayout>;
}
