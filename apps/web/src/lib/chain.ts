import { createPublicClient, http } from "viem";
import { hashkey, hashkeyTestnet } from "viem/chains";

/**
 * Single source of truth for which HashKey Chain network the app talks to.
 * Defaults to the testnet (chain 133) — set NEXT_PUBLIC_HSK_NETWORK=mainnet
 * to point at HashKey Chain Mainnet (chain 177, real HSK) instead.
 */
export const hskChain =
  process.env.NEXT_PUBLIC_HSK_NETWORK === "mainnet" ? hashkey : hashkeyTestnet;

export const publicClient = createPublicClient({
  chain: hskChain,
  transport: http(),
});
