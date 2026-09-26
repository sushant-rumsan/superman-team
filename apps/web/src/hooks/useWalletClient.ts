import { useMemo } from "react";
import { createWalletClient, custom } from "viem";

import { useAuth } from "@/app/providers";
import { hskChain } from "@/lib/chain";

/**
 * A viem WalletClient backed by the signed-in Magic embedded wallet, bound
 * to its address so callers don't need to pass `account` on every call, or
 * null when there's no active session. Magic's rpcProvider implements
 * EIP-1193 at runtime, but its `request` method is typed `protected` (it's
 * meant to be consumed via ethers/web3 adapters), so it needs a cast to
 * satisfy viem's `custom()` transport — this is the pattern Magic's own
 * docs use for viem integration. Deliberately not return-type-annotated:
 * that would widen the account type back to `Account | undefined` and
 * defeat the point of binding it.
 */
export function useMagicWalletClient() {
  const auth = useAuth();
  const { status, magic } = auth;
  const address = auth.status === "signed-in" ? auth.address : undefined;

  return useMemo(() => {
    if (status !== "signed-in" || !magic || !address) return null;

    return createWalletClient({
      account: address,
      chain: hskChain,
      transport: custom(
        magic.rpcProvider as unknown as Parameters<typeof custom>[0],
      ),
    });
  }, [status, magic, address]);
}
