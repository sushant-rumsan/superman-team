/** HSK sent to a fresh wallet so it can pay gas. */
export const FUND_AMOUNT_HSK = "0.05";
/** A wallet holding less HSK than this (18 decimals) is eligible for funding. */
export const FUND_BELOW_WEI = 50_000_000_000_000_000n; // 0.05 HSK
