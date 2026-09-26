"use client";

import type { Market } from "@/hooks/useMarket";
import { ASSET, TIER_NAMES } from "@/lib/config";
import { fmtPrice } from "@/lib/format";
import { Chip, Skeleton } from "./ui";

const TIER_TONE = ["down", "warn", "accent", "up"] as const;

/** Price on the left, KYC tier + leverage cap on the right. Sits above the trade card. */
export function MarketBar({ market, signedIn }: { market?: Market; signedIn: boolean }) {
  if (!market) {
    return (
      <div className="flex items-end justify-between px-1">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>
    );
  }

  const { tier, maxLeverage, markPrice } = market;
  const locked = maxLeverage === 0;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <div className="text-sm text-muted">{ASSET} / USDT</div>
        {/* key= remounts the node so the flash animation replays on every change */}
        <div key={markPrice.toString()} className="flash text-4xl font-semibold tracking-tight">
          ${fmtPrice(markPrice)}
        </div>
      </div>

      {signedIn && (
        <div className="flex flex-col items-end gap-1.5">
          <Chip tone={TIER_TONE[tier] ?? "down"}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {TIER_NAMES[tier] ?? `Tier ${tier}`}
            <span className="opacity-60">·</span>
            {locked ? "trading locked" : `up to ${maxLeverage}x`}
          </Chip>
          {!market.kycEnforced && (
            <span className="text-xs text-warn">KYC off — 10x for everyone</span>
          )}
        </div>
      )}
    </div>
  );
}
