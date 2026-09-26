import { BaseError, ContractFunctionRevertedError, parseUnits } from "viem";

const USDT_DECIMALS = 6;
const ONE = 10n ** BigInt(USDT_DECIMALS);

const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 6-decimal bigint -> "1,234.56" (sign preserved, never cast to unsigned). */
export function fmtUsdt(value: bigint, dp = 2): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const scale = 10n ** BigInt(USDT_DECIMALS - dp);
  const rounded = (abs + scale / 2n) / scale;
  const whole = rounded / 10n ** BigInt(dp);
  const frac = (rounded % 10n ** BigInt(dp)).toString().padStart(dp, "0");
  return `${neg && rounded !== 0n ? "-" : ""}${group(whole.toString())}${dp ? "." + frac : ""}`;
}

export const fmtSigned = (value: bigint, dp = 2) =>
  `${value > 0n ? "+" : ""}${fmtUsdt(value, dp)}`;

/** pnl / collateral as a signed percentage string, e.g. "-12.34%". */
export function fmtPct(pnl: bigint, collateral: bigint): string {
  if (collateral === 0n) return "0.00%";
  const bps = (pnl * 10000n) / collateral; // truncates toward zero
  const neg = bps < 0n;
  const abs = neg ? -bps : bps;
  const s = `${(abs / 100n).toString()}.${(abs % 100n).toString().padStart(2, "0")}%`;
  return neg ? `-${s}` : `+${s}`;
}

/** "12.5" -> 12_500_000n. Returns undefined on empty / malformed / >6dp input. */
export function parseUsdt(input: string): bigint | undefined {
  const s = input.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return undefined;
  const [, frac = ""] = s.split(".");
  if (frac.length > USDT_DECIMALS) return undefined;
  try {
    return parseUnits(s, USDT_DECIMALS);
  } catch {
    return undefined;
  }
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const fmtHsk = (wei: bigint) => {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 14n; // 4dp
  return `${group(whole.toString())}.${frac.toString().padStart(4, "0")}`;
};

export { ONE as USDT_ONE };

/** Pull the most specific, human-readable revert reason out of a viem error. */
export function errorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return (
        reverted.reason ||
        reverted.data?.errorName ||
        reverted.shortMessage ||
        "Transaction reverted"
      );
    }
    if (/user rejected|denied|rejected/i.test(err.shortMessage)) {
      return "Transaction was rejected in the wallet";
    }
    return err.shortMessage || err.message.split("\n")[0];
  }
  if (err instanceof Error) return err.message.split("\n")[0];
  return "Transaction failed";
}

/** USDT notional / 6-decimal price -> asset units, 4dp (e.g. $500 @ $0.25 -> "2,000.0000"). */
export function fmtAssetAmount(notional: bigint, price: bigint): string {
  if (price === 0n) return "—";
  const units = (notional * 10_000n) / price; // 4dp fixed point
  return `${group((units / 10_000n).toString())}.${(units % 10_000n).toString().padStart(4, "0")}`;
}

/** The engine liquidates once a position's loss reaches this % of its collateral. */
export const LIQ_LOSS_PCT = 90;

/** Liquidation price = entry * (1 - 0.9 / leverage), in integer math. */
export function liqPriceFor(entry: bigint, leverage: number): bigint {
  const lev = BigInt(leverage);
  return (entry * (10n * lev - 9n)) / (10n * lev);
}

/** Token prices are ~$0.10, so show 4dp — 2dp would hide a 1% move. */
export const fmtPrice = (price: bigint) => fmtUsdt(price, 4);
