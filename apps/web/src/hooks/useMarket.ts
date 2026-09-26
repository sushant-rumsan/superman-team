"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";

import { publicClient } from "@/lib/chain";
import { ENGINE, USDT, engineAbi, usdtAbi } from "@/lib/config";

export type Position = {
  collateral: bigint;
  positionSize: bigint;
  entryPrice: bigint;
  leverage: number;
  isOpen: boolean;
};

export type Market = {
  markPrice: bigint;
  kycEnforced: boolean;
  owner: Address;
  poolUsdt: bigint;
  // account-scoped (zero/empty when signed out)
  hsk: bigint;
  usdt: bigint;
  allowance: bigint;
  tier: number;
  maxLeverage: number;
  position: Position;
  liquidatable: boolean;
  pnl: bigint;
};

const POLL_MS = 3000;
const EMPTY_POSITION: Position = {
  collateral: 0n,
  positionSize: 0n,
  entryPrice: 0n,
  leverage: 0,
  isOpen: false,
};

async function load(account?: Address): Promise<Market> {
  if (!ENGINE || !USDT) throw new Error("NEXT_PUBLIC_ENGINE / NEXT_PUBLIC_USDT not set");
  const engine = { address: ENGINE, abi: engineAbi } as const;
  const usdt = { address: USDT, abi: usdtAbi } as const;

  const [markPrice, kycEnforced, owner, poolUsdt] = await Promise.all([
    publicClient.readContract({ ...engine, functionName: "markPrice" }),
    publicClient.readContract({ ...engine, functionName: "kycEnforced" }),
    publicClient.readContract({ ...engine, functionName: "owner" }),
    publicClient.readContract({ ...usdt, functionName: "balanceOf", args: [ENGINE] }),
  ]);

  const base = {
    markPrice,
    kycEnforced,
    owner,
    poolUsdt,
    hsk: 0n,
    usdt: 0n,
    allowance: 0n,
    tier: 0,
    maxLeverage: 0,
    position: EMPTY_POSITION,
    liquidatable: false,
    pnl: 0n,
  };
  if (!account) return base;

  const [hsk, usdtBal, allowance, tier, maxLeverage, pos, check] = await Promise.all([
    publicClient.getBalance({ address: account }),
    publicClient.readContract({ ...usdt, functionName: "balanceOf", args: [account] }),
    publicClient.readContract({ ...usdt, functionName: "allowance", args: [account, ENGINE] }),
    publicClient.readContract({ ...engine, functionName: "kycTiers", args: [account] }),
    publicClient.readContract({ ...engine, functionName: "getMaxLeverage", args: [account] }),
    publicClient.readContract({ ...engine, functionName: "positions", args: [account] }),
    publicClient.readContract({ ...engine, functionName: "checkPosition", args: [account] }),
  ]);

  return {
    ...base,
    hsk,
    usdt: usdtBal,
    allowance,
    tier,
    maxLeverage,
    position: {
      collateral: pos[0],
      positionSize: pos[1],
      entryPrice: pos[2],
      leverage: pos[3],
      isOpen: pos[4],
    },
    liquidatable: check[0],
    pnl: check[1],
  };
}

/** Polls all on-chain state every 3s (and on demand via `refresh`). */
export function useMarket(account?: Address) {
  const [market, setMarket] = useState<Market>();
  const [error, setError] = useState<string>();
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const next = await load(account);
      if (id === seq.current) {
        setMarket(next);
        setError(undefined);
      }
    } catch (err) {
      if (id === seq.current) {
        setError(err instanceof Error ? err.message.split("\n")[0] : "RPC error");
      }
    }
  }, [account]);

  useEffect(() => {
    // Drop the previous account's data so a stale tier/position never shows
    // for the new one; refresh() below repopulates it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarket(undefined);
    refresh();
    const t = setInterval(refresh, POLL_MS);
    const counter = seq;
    return () => {
      clearInterval(t);
      counter.current++; // invalidate any in-flight load
    };
  }, [refresh]);

  return { market, error, refresh };
}
