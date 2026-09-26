"use client";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/providers";
import { useMarket } from "@/hooks/useMarket";
import { useMagicWalletClient } from "@/hooks/useWalletClient";
import { hskChain } from "@/lib/chain";
import { FUND_BELOW_WEI } from "@/lib/fund";

export type Funding = { phase: "idle" | "pending" | "done" | "error"; error?: string };

/** Account + on-chain state + the "can this user send a tx right now" gates. */
export function useSession() {
  const auth = useAuth();
  const walletClient = useMagicWalletClient();
  const account = auth.status === "signed-in" ? auth.address : undefined;
  const { market, error, refresh } = useMarket(account);

  // Wrong-network detection: ask the wallet which chain it's actually on.
  const [walletChain, setWalletChain] = useState<number>();
  useEffect(() => {
    if (!walletClient) return;
    let ignore = false;
    const check = () =>
      walletClient
        .getChainId()
        .then((id) => !ignore && setWalletChain(id))
        .catch(() => {});
    check();
    const t = setInterval(check, 5000);
    return () => {
      ignore = true;
      clearInterval(t);
    };
  }, [walletClient]);

  // Gas sponsorship: a wallet with (almost) no HSK gets a one-off grant from
  // the server. Attempted at most once per address per page load.
  const [funding, setFunding] = useState<Funding>({ phase: "idle" });
  const fundingTried = useRef(new Set<string>());
  const hsk = market?.hsk;
  useEffect(() => {
    if (!account || hsk === undefined || hsk >= FUND_BELOW_WEI) return;
    if (fundingTried.current.has(account)) return;
    fundingTried.current.add(account);
    setFunding({ phase: "pending" });
    fetch("/api/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: account }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error ?? `Funding failed (${res.status})`);
        setFunding({ phase: "done" });
        refresh();
      })
      .catch((err) =>
        setFunding({ phase: "error", error: err instanceof Error ? err.message : "Funding failed" }),
      );
  }, [account, hsk, refresh]);

  const wrongNetwork = !!walletClient && walletChain !== undefined && walletChain !== hskChain.id;
  const signedIn = !!account;
  const noGas = signedIn && !!market && market.hsk === 0n;
  const canTx = signedIn && !!market && !wrongNetwork && !noGas;
  const isOwner =
    !!account && !!market && market.owner.toLowerCase() === account.toLowerCase();

  return {
    auth,
    walletClient,
    account,
    market,
    error,
    refresh,
    walletChain,
    wrongNetwork,
    signedIn,
    noGas,
    funding,
    canTx,
    isOwner,
  };
}

export type Session = ReturnType<typeof useSession>;
