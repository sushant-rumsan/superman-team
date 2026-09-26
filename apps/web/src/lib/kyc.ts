import type { Address } from "viem";

/**
 * The one place the KYC flow is triggered from the UI (components/KycButton.tsx).
 * Demo: asks /api/kyc to self-approve the wallet — no real identity check.
 */
export async function startKyc(address: Address): Promise<void> {
  const res = await fetch("/api/kyc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `KYC failed (${res.status})`);
}
