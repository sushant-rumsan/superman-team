"use client";

import Link from "next/link";
import { useState } from "react";

import type { Market } from "@/hooks/useMarket";
import { useTx } from "@/hooks/useTx";
import { ASSET, ENGINE, TIER_NAMES, USDT, engineAbi, usdtAbi } from "@/lib/config";
import { LIQ_LOSS_PCT, fmtAssetAmount, fmtPrice, fmtUsdt, liqPriceFor, parseUsdt } from "@/lib/format";
import { Alert, Btn, Row, Skeleton, TxStatus } from "./ui";

const LEVERAGE_STEPS = [1, 2, 3, 5, 10];
function TokenPill({ children }: { children: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full bg-surface-3 py-1.5 pl-2 pr-3.5 text-lg font-semibold">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
        {children.slice(0, 1)}
      </span>
      {children}
    </span>
  );
}

export function TradePanel({
  market,
  signedIn,
  canTx,
  refresh,
}: {
  market?: Market;
  signedIn: boolean;
  canTx: boolean;
  refresh: () => void;
}) {
  const [collateralInput, setCollateralInput] = useState("");
  const [wantedLeverage, setWantedLeverage] = useState(2);
  const approve = useTx(refresh);
  const open = useTx(refresh);

  if (!market) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (market.position.isOpen) {
    return (
      <p className="rounded-2xl bg-surface-2 p-5 text-center text-muted">
        You already have an open position — one per address. Close it from the Position tab to open
        a new one.
      </p>
    );
  }

  // Signed-out visitors get a preview of the full 10x range.
  const max = signedIn ? market.maxLeverage : 10;
  const locked = signedIn && max === 0;
  const leverage = locked ? 0 : Math.min(Math.max(wantedLeverage, 1), max);
  const steps = [...LEVERAGE_STEPS.filter((n) => n <= max), ...(LEVERAGE_STEPS.includes(max) ? [] : [max])]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const collateral = parseUsdt(collateralInput);
  const hasAmount = collateral !== undefined && collateral > 0n;
  const size = hasAmount && leverage > 0 ? collateral * BigInt(leverage) : undefined;
  const liqPrice = leverage > 0 ? liqPriceFor(market.markPrice, leverage) : undefined;
  const liqDropPct = leverage > 0 ? LIQ_LOSS_PCT / leverage : undefined;

  const needsApproval = hasAmount && market.allowance < collateral;

  let problem: string | undefined;
  if (collateralInput.trim() === "") problem = "Enter an amount";
  else if (collateral === undefined) problem = "Invalid amount";
  else if (collateral === 0n) problem = "Enter an amount";
  else if (collateral > market.usdt) problem = "Insufficient USDT";
  else if (!canTx) problem = "No HSK for gas";

  const tierName = TIER_NAMES[market.tier] ?? `Tier ${market.tier}`;

  return (
    <div>
      {locked && (
        <div className="mb-3">
          <Alert tone="amber">
            Your KYC tier ({tierName}) can&apos;t trade with leverage yet. Verify your identity to
            unlock margin trading.
          </Alert>
        </div>
      )}

      <fieldset disabled={locked} className={`min-w-0 space-y-1 ${locked ? "opacity-50" : ""}`}>
        {/* Pay */}
        <div className="rounded-2xl bg-surface-2 p-4 focus-within:ring-1 focus-within:ring-accent/40">
          <div className="flex items-center justify-between text-sm text-muted">
            <label htmlFor="collateral">You put up</label>
            {signedIn && (
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setCollateralInput(fmtUsdt(market.usdt, 6).replace(/,/g, ""))}
              >
                Balance: {fmtUsdt(market.usdt)} · <span className="font-semibold text-accent">MAX</span>
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="collateral"
              className="min-w-0 flex-1 bg-transparent text-4xl font-medium outline-none placeholder:text-muted/40"
              inputMode="decimal"
              autoComplete="off"
              value={collateralInput}
              onChange={(e) => setCollateralInput(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
            />
            <TokenPill>USDT</TokenPill>
          </div>
          <div className="mt-2 h-5 text-sm text-muted">Collateral — the most you can lose</div>
        </div>

        {/* Get */}
        <div className="relative rounded-2xl bg-surface-2 p-4">
          <div className="absolute -top-4 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-xl border-4 border-surface bg-surface-3 text-sm text-muted">
            ↓
          </div>
          <div className="text-sm text-muted">You get long exposure to</div>
          <div className="mt-2 flex items-center gap-3">
            <div
              className={`min-w-0 flex-1 truncate text-4xl font-medium ${size ? "" : "text-muted/40"}`}
            >
              {size !== undefined ? fmtAssetAmount(size, market.markPrice) : "0"}
            </div>
            <TokenPill>{ASSET}</TokenPill>
          </div>
          <div className="mt-2 h-5 text-sm text-muted">
            {size !== undefined ? `$${fmtUsdt(size)} position size` : "Collateral × leverage"}
          </div>
        </div>

        {/* Leverage */}
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Leverage</span>
            <span className="text-sm text-muted">
              {signedIn ? (
                <>
                  Max <span className="font-semibold text-foreground">{max}x</span> for {tierName}
                </>
              ) : (
                "Sign in to see your limit"
              )}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {steps.length === 0 && <span className="text-sm text-muted">—</span>}
            {steps.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWantedLeverage(n)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                  n === leverage
                    ? "bg-accent text-black"
                    : "bg-surface-3 text-muted hover:text-foreground"
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      {/* Risk details */}
      <div className="mt-3 rounded-2xl border border-line px-4 py-2.5">
        <Row label="Entry price" hint="Current mark price">
          ${fmtPrice(market.markPrice)}
        </Row>
        <Row
          label="Liquidation price"
          hint={`Position is liquidated when its loss reaches ${LIQ_LOSS_PCT}% of collateral`}
          valueClass="text-down"
        >
          {liqPrice !== undefined ? (
            <>
              ${fmtPrice(liqPrice)}{" "}
              <span className="text-xs opacity-70">(−{liqDropPct?.toFixed(1)}%)</span>
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Max loss" hint="Long only — you can never lose more than your collateral">
          {hasAmount ? `$${fmtUsdt(collateral)}` : "—"}
        </Row>
        <Row label="Pool liquidity" hint="Profits are paid from this pool; payouts are capped by it">
          ${fmtUsdt(market.poolUsdt)}
        </Row>
      </div>

      {/* CTA */}
      <div className="mt-3">
        {!signedIn ? (
          <Link
            href="/auth"
            className="block w-full rounded-2xl bg-accent px-5 py-4 text-center text-lg font-semibold text-black transition hover:brightness-110"
          >
            Sign in to trade
          </Link>
        ) : locked ? (
          <Btn size="lg" variant="ghost" disabled>
            Trading locked
          </Btn>
        ) : problem ? (
          <Btn size="lg" variant="ghost" disabled>
            {problem}
          </Btn>
        ) : needsApproval ? (
          <Btn
            size="lg"
            busy={approve.busy}
            disabled={!USDT || !ENGINE}
            onClick={() =>
              USDT &&
              ENGINE &&
              collateral !== undefined &&
              approve.run({
                address: USDT,
                abi: usdtAbi,
                functionName: "approve",
                args: [ENGINE, collateral],
              })
            }
          >
            Approve USDT
          </Btn>
        ) : (
          <Btn
            size="lg"
            variant="up"
            busy={open.busy}
            disabled={!ENGINE}
            onClick={() =>
              ENGINE &&
              collateral !== undefined &&
              open.run({
                address: ENGINE,
                abi: engineAbi,
                functionName: "openLong",
                args: [collateral, leverage],
              })
            }
          >
            Open {leverage}x long
          </Btn>
        )}
      </div>

      {signedIn && problem === "Insufficient USDT" && (
        <p className="mt-2 text-center text-sm text-muted">
          Grab some from the account menu → “Get test USDT”.
        </p>
      )}
      {needsApproval && !problem && (
        <p className="mt-2 text-center text-sm text-muted">
          Step 1 of 2 — allow the engine to use {fmtUsdt(collateral ?? 0n)} USDT.
        </p>
      )}
      <TxStatus tx={approve} />
      <TxStatus tx={open} />
    </div>
  );
}
