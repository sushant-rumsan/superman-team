"use client";

import { useCallback, useState } from "react";
import type { Abi, Address, Hash } from "viem";

import { useMagicWalletClient } from "@/hooks/useWalletClient";
import { hskChain, publicClient } from "@/lib/chain";
import { errorMessage } from "@/lib/format";

export type TxCall = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type TxState = {
  /** "signing" = waiting on wallet, "mining" = waiting for receipt */
  phase?: "signing" | "mining";
  error?: string;
  hash?: Hash;
};

/**
 * Runs a contract write honestly: simulate first (so the *real* revert reason
 * surfaces before the wallet prompt), sign, wait for the receipt, and treat a
 * reverted receipt as a failure. Returns true only on a mined, successful tx.
 */
export function useTx(onDone?: () => void) {
  const walletClient = useMagicWalletClient();
  const [state, setState] = useState<TxState>({});

  const run = useCallback(
    async (call: TxCall): Promise<boolean> => {
      if (!walletClient) {
        setState({ error: "Not signed in" });
        return false;
      }
      setState({ phase: "signing" });
      try {
        const { request } = await publicClient.simulateContract({
          ...call,
          account: walletClient.account,
        } as never);
        const hash = await walletClient.writeContract({
          ...(request as object),
          chain: hskChain,
        } as never);
        setState({ phase: "mining", hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          setState({ hash, error: "Transaction reverted on-chain" });
          return false;
        }
        setState({ hash });
        onDone?.();
        return true;
      } catch (err) {
        console.error(err);
        setState({ error: errorMessage(err) });
        return false;
      }
    },
    [walletClient, onDone],
  );

  return { ...state, busy: !!state.phase, run, clear: () => setState({}) };
}
