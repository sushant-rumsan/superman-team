"use client";

import type { Market } from "@/hooks/useMarket";
import { useTx } from "@/hooks/useTx";
import { ASSET, ENGINE, engineAbi } from "@/lib/config";
import { fmtAssetAmount, fmtPct, fmtPrice, fmtSigned, fmtUsdt, liqPriceFor } from "@/lib/format";
import { Btn, Chip, Row, TxStatus } from "./ui";

/** How much of the loss the position can absorb is used up, 0–100. Liquidation at 100. */
function riskUsedPct(pnl: bigint, collateral: bigint): number {
  if (pnl >= 0n || collateral === 0n) return 0;
  // loss / (90% of collateral), in basis points, capped
  const bps = Number((-pnl * 10_000n) / ((collateral * 90n) / 100n));
  return Math.min(100, bps / 100);
}

export function PositionPanel({
  market,
  canTx,
  refresh,
}: {
  market: Market;
  canTx: boolean;
  refresh: () => void;
}) {
  const close = useTx(refresh);
  const { position: p, pnl, liquidatable } = market;
  if (!p.isOpen) return null;

  const liqPrice = liqPriceFor(p.entryPrice, p.leverage);
  const up = pnl >= 0n;
  const used = riskUsedPct(pnl, p.collateral);
  const barTone = used > 66 ? "bg-down" : used > 33 ? "bg-warn" : "bg-up";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          Long {ASSET}
          <Chip tone="accent">{p.leverage}x</Chip>
        </div>
        {liquidatable ? (
          <Chip tone="down" className="pulse-ring">
            Liquidatable
          </Chip>
        ) : (
          <Chip tone={used > 66 ? "down" : used > 33 ? "warn" : "up"}>
            {used > 66 ? "At risk" : used > 33 ? "Watch" : "Healthy"}
          </Chip>
        )}
      </div>

      <div className="mt-5 text-center">
        <div className="text-sm text-muted">Unrealised PnL</div>
        <div
          key={pnl.toString()}
          className={`flash mt-1 text-5xl font-semibold tracking-tight ${up ? "text-up" : "text-down"}`}
        >
          {fmtSigned(pnl)}
          <span className="ml-2 text-xl font-medium opacity-70">USDT</span>
        </div>
        <div className={`mt-1 text-lg font-medium ${up ? "text-up" : "text-down"}`}>
          {fmtPct(pnl, p.collateral)} on collateral
        </div>
      </div>

      {/* Distance to liquidation */}
      <div className="mt-6 rounded-2xl bg-surface-2 p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Distance to liquidation</span>
          <span className="font-medium">
            ${fmtPrice(market.markPrice)} <span className="text-muted">→</span>{" "}
            <span className="text-down">${fmtPrice(liqPrice)}</span>
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barTone}`}
            style={{ width: `${Math.max(used, 2)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>Safe</span>
          <span>Liquidated</span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line px-4 py-2.5">
        <Row label="Collateral">${fmtUsdt(p.collateral)}</Row>
        <Row label="Position size">${fmtUsdt(p.positionSize)}</Row>
        <Row label={`${ASSET} exposure`}>
          {fmtAssetAmount(p.positionSize, p.entryPrice)} {ASSET}
        </Row>
        <Row label="Entry price">${fmtPrice(p.entryPrice)}</Row>
        <Row label="Mark price">${fmtPrice(market.markPrice)}</Row>
        <Row label="Liquidation price" valueClass="text-down">
          ${fmtPrice(liqPrice)}
        </Row>
      </div>

      <div className="mt-3">
        <Btn
          size="lg"
          variant={liquidatable ? "ghost" : "primary"}
          busy={close.busy}
          disabled={liquidatable || !canTx || !ENGINE}
          onClick={() =>
            ENGINE && close.run({ address: ENGINE, abi: engineAbi, functionName: "closePosition" })
          }
        >
          Close position
        </Btn>
        {liquidatable && (
          <p className="mt-2 text-center text-sm text-down">
            This position is liquidatable and can no longer be closed.
          </p>
        )}
        {!canTx && !liquidatable && (
          <p className="mt-2 text-center text-sm text-warn">No HSK for gas.</p>
        )}
      </div>
      <TxStatus tx={close} />
    </div>
  );
}
