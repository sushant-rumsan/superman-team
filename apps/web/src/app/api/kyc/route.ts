import { createWalletClient, http, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { hskChain, publicClient } from "@/lib/chain";
import { ENGINE, engineAbi } from "@/lib/config";

/**
 * DEMO ONLY: self-approve KYC. Signs setKycTier(address, KYC_TIER) with the
 * engine owner's key for whoever asks — there is no identity check, so anyone
 * can grant themselves the tier. Replace with a real provider before mainnet.
 * Server-only — OWNER_PRIVATE_KEY must never be NEXT_PUBLIC_.
 */
const KYC_TIER = 3; // PREMIUM → 10x

// Serialise owner sends so concurrent approvals don't race on the nonce.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
};

export async function POST(request: Request) {
  const key = process.env.OWNER_PRIVATE_KEY as Hex | undefined;
  const engine = ENGINE;
  if (!key || !engine) {
    return Response.json(
      { error: "KYC not configured (OWNER_PRIVATE_KEY / NEXT_PUBLIC_ENGINE missing on the server)" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { address?: string } | null;
  const address = body?.address;
  if (!address || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const account = privateKeyToAccount(key);
    const owner = await publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: "owner",
    });
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      return Response.json(
        { error: "OWNER_PRIVATE_KEY is not the engine owner" },
        { status: 500 },
      );
    }

    const current = await publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: "kycTiers",
      args: [address as Address],
    });
    if (current >= KYC_TIER) return Response.json({ approved: true, tier: current });

    const wallet = createWalletClient({ account, chain: hskChain, transport: http() });
    const hash = await enqueue(() =>
      wallet.writeContract({
        address: engine,
        abi: engineAbi,
        functionName: "setKycTier",
        args: [address as Address, KYC_TIER],
      }),
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("setKycTier transaction reverted");

    return Response.json({ approved: true, tier: KYC_TIER, hash });
  } catch (err) {
    console.error("kyc failed:", err);
    const message =
      err instanceof Error
        ? ((err as { shortMessage?: string }).shortMessage ?? err.message.split("\n")[0])
        : "KYC failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
