import Link from "next/link";
import DataPolicyLayout from "@/components/DataPolicyLayout";
export default function TermsPage() {
  return <DataPolicyLayout title="Using FinTrack">
    <p>Updated 16 October 2026. FinTrack helps you record and review your finances. You are responsible for checking amounts, categories, dates, accounts, and extracted receipt details before confirming a transaction.</p>
    <h2>Financial information</h2><p>Balances and reports depend on the data entered and available exchange-rate inputs. AI insights and trading reviews can be incomplete or incorrect. They are informational tools and do not guarantee an investment result or replace your own decisions.</p>
    <h2>Your account</h2><p>Keep your credentials and device access secure. Only upload records you are allowed to use. Do not submit passwords, authentication secrets, or full payment-card details in transaction notes or support requests.</p>
    <h2>Free and Pro access</h2><p>Available limits and checkout pricing are shown in the app when configured. Paid access is applied only after verified payment confirmation. Existing records remain readable and exportable when Pro access ends; paid write features may become unavailable. A data deletion request does not automatically reverse a payment. Payment questions can be submitted through the signed-in request form.</p>
    <h2>Availability and requests</h2><p>Features depend on network access and configured services. Keep exports of important records. Submit <Link href="/data-controls">support or data requests</Link> from your account and monitor their status. These terms do not promise a response deadline or uninterrupted availability.</p>
  </DataPolicyLayout>;
}
