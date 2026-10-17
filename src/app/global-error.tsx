"use client";

import { ErrorRecoveryPanel } from "@/components/ErrorRecoveryPanel";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
};

export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="id">
      <head>
        <title>DuitLo - Pemulihan aplikasi</title>
      </head>
      <body style={{ margin: 0, minHeight: "100svh", background: "#f7faf7" }}>
        <ErrorRecoveryPanel
          eyebrow="DuitLo recovery"
          title="DuitLo perlu dimuat ulang"
          description="Lapisan utama aplikasi berhenti sebelum siap. Data privat tidak ditampilkan. Coba pulihkan aplikasi atau buka dashboard."
          retryLabel="Pulihkan aplikasi"
          dashboardLabel="Buka dashboard"
          onRetry={retry}
        />
      </body>
    </html>
  );
}
