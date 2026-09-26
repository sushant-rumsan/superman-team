"use client";

import { useCallback, useEffect, useState } from "react";
import type { Hash } from "viem";

import { useAuth } from "@/app/providers";
import { useMagicWalletClient } from "@/hooks/useWalletClient";
import { contracts } from "@/contracts/generated";
import { hskChain, publicClient } from "@/lib/chain";
import { Spinner } from "./Spinner";

const counter = contracts.Counter;
const address = (counter.address as Record<number, `0x${string}` | undefined>)[
  hskChain.id
];

export function Counter() {
  const { status } = useAuth();
  const walletClient = useMagicWalletClient();

  const [count, setCount] = useState<bigint>();
  const [pending, setPending] = useState<"signing" | "mining">();
  const [error, setError] = useState<string>();

  const readCount = useCallback(async () => {
    if (!address) return undefined;
    return publicClient.readContract({
      address,
      abi: counter.abi,
      functionName: "x",
    });
  }, []);

  const refresh = useCallback(async () => {
    setCount(await readCount());
  }, [readCount]);

  useEffect(() => {
    let ignore = false;
    readCount().then((value) => {
      if (!ignore) setCount(value);
    });
    return () => {
      ignore = true;
    };
  }, [readCount]);

  if (!address) {
    return (
      <p className="text-zinc-500">
        Counter isn&apos;t deployed on {hskChain.name} yet. Run{" "}
        <code className="font-mono">npm run deploy:hsk-testnet</code> from the
        repo root.
      </p>
    );
  }

  if (status !== "signed-in") {
    return <p className="text-zinc-500">Sign in with Google to interact with Counter.</p>;
  }

  const increment = async () => {
    if (!walletClient) return;
    setError(undefined);
    try {
      setPending("signing");
      const hash: Hash = await walletClient.writeContract({
        address,
        abi: counter.abi,
        functionName: "inc",
        chain: hskChain,
      });
      setPending("mining");
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message.split("\n")[0] : "Transaction failed");
    } finally {
      setPending(undefined);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-7xl font-semibold tabular-nums">
        {count?.toString() ?? "…"}
      </div>
      <button
        onClick={increment}
        disabled={!!pending}
        className="flex items-center gap-2 rounded-md bg-foreground px-6 py-3 font-medium text-background disabled:opacity-50"
      >
        {pending && <Spinner className="h-4 w-4" />}
        {pending === "signing"
          ? "Confirm in wallet…"
          : pending === "mining"
            ? "Mining…"
            : "Increment"}
      </button>
      <p className="font-mono text-xs text-zinc-500">{address}</p>
      {error && <p className="max-w-md text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
