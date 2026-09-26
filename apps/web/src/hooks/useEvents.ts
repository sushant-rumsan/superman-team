"use client";

import { useEffect, useRef, useState } from "react";
import type { Address, Hash } from "viem";

import { publicClient } from "@/lib/chain";
import { ENGINE, engineAbi } from "@/lib/config";

export type FeedEvent = {
  id: string;
  kind: "opened" | "closed" | "liquidated" | "price";
  who?: Address;
  tx: Hash;
  block: bigint;
  // opened
  collateral?: bigint;
  leverage?: number;
  size?: bigint;
  // closed
  pnl?: bigint;
  payout?: bigint;
  // liquidated
  seized?: bigint;
  liquidator?: Address;
  // price
  price?: bigint;
};

const EVENTS = engineAbi.filter((i) => i.type === "event");
const LOOKBACKS = [20_000n, 5_000n, 1_000n]; // RPCs cap getLogs ranges; back off
const MAX_EVENTS = 50;

async function fetchRange(from: bigint, to: bigint): Promise<FeedEvent[]> {
  const logs = await publicClient.getLogs({
    address: ENGINE,
    events: EVENTS,
    fromBlock: from,
    toBlock: to,
  });
  const out: FeedEvent[] = [];
  for (const log of logs) {
    if (!log.transactionHash) continue;
    const base = {
      id: `${log.transactionHash}-${log.logIndex}`,
      tx: log.transactionHash,
      block: log.blockNumber,
    };
    switch (log.eventName) {
      case "PositionOpened":
        out.push({
          ...base,
          kind: "opened",
          who: log.args.trader,
          collateral: log.args.collateralUSDT,
          leverage: log.args.leverage,
          size: log.args.size,
        });
        break;
      case "PositionClosed":
        out.push({
          ...base,
          kind: "closed",
          who: log.args.trader,
          pnl: log.args.pnl,
          payout: log.args.payout,
        });
        break;
      case "PositionLiquidated":
        out.push({
          ...base,
          kind: "liquidated",
          who: log.args.trader,
          seized: log.args.seizedUSDT,
          liquidator: log.args.liquidator,
        });
        break;
      case "PriceUpdated":
        out.push({ ...base, kind: "price", price: log.args.newPrice });
        break;
    }
  }
  return out;
}

/** Newest-first feed of engine events; backfills recent history then polls. */
export function useEvents(onNew?: () => void) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [error, setError] = useState<string>();
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  });

  useEffect(() => {
    if (!ENGINE) return;
    let stopped = false;
    let cursor: bigint | undefined; // last block already fetched
    let timer: ReturnType<typeof setTimeout>;

    const merge = (incoming: FeedEvent[]) =>
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = incoming.filter((e) => !seen.has(e.id));
        if (!fresh.length) return prev;
        return [...fresh, ...prev]
          .sort((a, b) => (a.block === b.block ? 0 : a.block < b.block ? 1 : -1))
          .slice(0, MAX_EVENTS);
      });

    const tick = async () => {
      try {
        const head = await publicClient.getBlockNumber();
        if (cursor === undefined) {
          let lastErr: unknown;
          for (const back of LOOKBACKS) {
            try {
              const from = head > back ? head - back : 0n;
              const found = await fetchRange(from, head);
              if (!stopped) merge(found);
              cursor = head;
              lastErr = undefined;
              break;
            } catch (err) {
              lastErr = err;
            }
          }
          if (lastErr) throw lastErr;
        } else if (head > cursor) {
          const found = await fetchRange(cursor + 1n, head);
          cursor = head;
          if (!stopped && found.length) {
            merge(found);
            onNewRef.current?.();
          }
        }
        if (!stopped) setError(undefined);
      } catch (err) {
        if (!stopped) {
          setError(err instanceof Error ? err.message.split("\n")[0] : "Failed to load events");
        }
      }
      if (!stopped) timer = setTimeout(tick, 3000);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return { events, error };
}
