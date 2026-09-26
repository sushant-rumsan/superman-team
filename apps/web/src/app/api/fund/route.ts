import { createWalletClient, http, isAddress, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { hskChain, publicClient } from "@/lib/chain";
import { FUND_AMOUNT_HSK, FUND_BELOW_WEI } from "@/lib/fund";

/**
 * Gas sponsor: sends a little HSK from the funder key to a freshly created
 * wallet. Server-only — FUNDER_PRIVATE_KEY must never be NEXT_PUBLIC_.
 *
 * Abuse guards (best effort, this is a testnet faucet): only wallets under
 * FUND_BELOW_WEI are funded, and each address is limited to one grant per
 * cooldown. The cooldown map is in-memory, so it resets on restart/cold start.
 */
const COOLDOWN_MS = 60 * 60 * 1000;
const lastFunded = new Map<string, number>();
const inFlight = new Set<string>();

// Serialise sends so concurrent sign-ups don't race on the funder's nonce.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
};

export async function POST(request: Request) {
  const key = process.env.FUNDER_PRIVATE_KEY as Hex | undefined;
  if (!key) {
    return Response.json(
      { error: "Gas sponsor not configured (FUNDER_PRIVATE_KEY missing on the server)" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { address?: string } | null;
  const address = body?.address;
  if (!address || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  const id = address.toLowerCase();

  const last = lastFunded.get(id);
  if (last && Date.now() - last < COOLDOWN_MS) {
    return Response.json({ error: "This wallet was already funded recently" }, { status: 429 });
  }
  if (inFlight.has(id)) {
    return Response.json({ error: "Funding already in progress" }, { status: 409 });
  }

  inFlight.add(id);
  try {
    const balance = await publicClient.getBalance({ address: address as Address });
    if (balance >= FUND_BELOW_WEI) {
      return Response.json({ funded: false, reason: "Wallet already has HSK" });
    }

    const account = privateKeyToAccount(key);
    const wallet = createWalletClient({ account, chain: hskChain, transport: http() });
    const value = parseEther(FUND_AMOUNT_HSK);

    const hash = await enqueue(async () => {
      const funderBalance = await publicClient.getBalance({ address: account.address });
      if (funderBalance < value) {
        throw new Error("Gas sponsor is out of HSK — top up the funder wallet");
      }
      return wallet.sendTransaction({ to: address as Address, value });
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Funding transaction reverted");

    lastFunded.set(id, Date.now());
    return Response.json({ funded: true, hash, amount: FUND_AMOUNT_HSK });
  } catch (err) {
    console.error("fund failed:", err);
    const message = err instanceof Error ? (err as { shortMessage?: string }).shortMessage ?? err.message.split("\n")[0] : "Funding failed";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    inFlight.delete(id);
  }
}
