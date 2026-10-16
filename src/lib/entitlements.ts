export type Entitlements = {
  plan: "beta" | "free" | "pro";
  wallets: number | null;
  monthlyBudgets: number | null;
  goals: number | null;
  receiptScans: number | null;
  investmentWrites: boolean;
  reads: true;
  exports: true;
};

export function getEntitlements({ enabled, proUntil, now = new Date() }: {
  enabled: boolean;
  proUntil?: string | null;
  now?: Date;
}): Entitlements {
  const pro = Boolean(enabled && proUntil && new Date(proUntil).getTime() > now.getTime());
  return {
    plan: !enabled ? "beta" : pro ? "pro" : "free",
    wallets: !enabled || pro ? null : 3,
    monthlyBudgets: !enabled || pro ? null : 3,
    goals: !enabled || pro ? null : 1,
    receiptScans: !enabled ? null : pro ? 150 : 15,
    investmentWrites: !enabled || pro,
    reads: true,
    exports: true,
  };
}
