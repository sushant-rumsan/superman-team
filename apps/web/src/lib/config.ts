import { parseAbi, type Address } from "viem";

import { hskChain } from "./chain";

export const USDT = process.env.NEXT_PUBLIC_USDT as Address | undefined;
export const ENGINE = process.env.NEXT_PUBLIC_ENGINE as Address | undefined;

/** What the engine's mark price represents. The contract is asset-agnostic; the owner sets the price by hand. */
export const ASSET = "HSK";

export const EXPLORER =
  hskChain.blockExplorers?.default.url ?? "https://testnet-explorer.hsk.xyz";
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;

export const usdtAbi = parseAbi([
  "function faucet()",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

export const engineAbi = parseAbi([
  "function owner() view returns (address)",
  "function markPrice() view returns (uint256)",
  "function kycEnforced() view returns (bool)",
  "function kycTiers(address) view returns (uint8)",
  "function getMaxLeverage(address) view returns (uint8)",
  "function positions(address) view returns (uint256 collateral, uint256 positionSize, uint256 entryPrice, uint8 leverage, bool isOpen)",
  "function checkPosition(address) view returns (bool isLiquidatable, int256 pnl)",
  "function openLong(uint256 collateralUSDT, uint8 leverage)",
  "function closePosition()",
  "function liquidate(address trader)",
  "function depositLiquidity(uint256)",
  "function setKycTier(address, uint8)",
  "function toggleKycEnforcement(bool)",
  "function setPrice(uint256)",
  "event PositionOpened(address indexed trader, uint256 collateralUSDT, uint8 leverage, uint256 size)",
  "event PositionClosed(address indexed trader, int256 pnl, uint256 payout)",
  "event PositionLiquidated(address indexed trader, uint256 seizedUSDT, address liquidator)",
  "event PriceUpdated(uint256 newPrice)",
]);

export const TIER_NAMES = ["UNVERIFIED", "BASIC", "ADVANCED", "PREMIUM"] as const;
