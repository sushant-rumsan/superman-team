/**
 * Owner/admin CLI for the margin engine — run from the repo root:
 *
 *   npm run admin -- status
 *   npm run admin -- send-usdt <address> <amount>
 *   npm run admin -- set-price <usd | -10% | +10%>
 *   npm run admin -- set-tier <address> <0-3>
 *   npm run admin -- kyc <on|off>
 *   npm run admin -- deposit <amount>
 *   npm run admin -- liquidate <address>
 *
 * Signs with PRIVATE_KEY from packages/contracts/.env (the deployer, which is
 * the engine owner). Addresses come from deployedContracts.json for NETWORK.
 * Every write is simulated first so you see the real revert reason, then the
 * script waits for the receipt and only reports success if it mined OK.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, hashkey, hashkeyTestnet } from "viem/chains";

const root = path.resolve(import.meta.dirname, "..");
for (const envFile of [path.join(root, ".env"), path.resolve(root, "../../.env.local")]) {
  if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides vars already set
}

const CHAINS = { localhost: hardhat, hashkeyTestnet, hashkey } as const;
const networkName = (process.env.NETWORK || "hashkeyTestnet") as keyof typeof CHAINS;
const chain = CHAINS[networkName];
if (!chain) fail(`Unknown NETWORK "${networkName}". Use: ${Object.keys(CHAINS).join(", ")}`);

const usdtAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const engineAbi = parseAbi([
  "function owner() view returns (address)",
  "function markPrice() view returns (uint256)",
  "function kycEnforced() view returns (bool)",
  "function kycTiers(address) view returns (uint8)",
  "function getMaxLeverage(address) view returns (uint8)",
  "function setPrice(uint256)",
  "function setKycTier(address, uint8)",
  "function toggleKycEnforcement(bool)",
  "function depositLiquidity(uint256)",
  "function liquidate(address trader)",
]);

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function usage(): never {
  console.log(`Usage: npm run admin -- <command>

  status                          price, KYC state, pool + admin balances
  send-usdt <address> <amount>    transfer USDT from the admin wallet
  set-price <usd | -10% | +10%>   set the HSK mark price (absolute, or relative to current)
  set-tier <address> <0-3>        set a trader's KYC tier (0 none, 1 = 2x, 2 = 5x, 3 = 10x)
  kyc <on|off>                    turn KYC enforcement on/off
  deposit <amount>                add USDT to the liquidity pool
  liquidate <address>             liquidate an underwater position`);
  process.exit(1);
}

const deployments = JSON.parse(
  existsSync(path.join(root, "deployedContracts.json"))
    ? readFileSync(path.join(root, "deployedContracts.json"), "utf8")
    : "{}",
) as Record<string, { usdt: Address; marginEngine: Address }>;
const deployed = deployments[chain.id];
if (!deployed) fail(`No deployment for chain ${chain.id} in deployedContracts.json — deploy first.`);
const USDT = deployed.usdt;
const ENGINE = deployed.marginEngine;

const transport = http(process.env.PROVIDED_URL || chain.rpcUrls.default.http[0]);
const publicClient = createPublicClient({ chain, transport });

function getAccount() {
  const key = process.env.PRIVATE_KEY;
  if (!key) fail("PRIVATE_KEY is not set (packages/contracts/.env).");
  return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
}

const usd = (v: bigint, dp = 2) => Number(formatUnits(v, 6)).toLocaleString("en-US", {
  minimumFractionDigits: dp,
  maximumFractionDigits: dp,
});

function parseAmount(input: string | undefined, what = "amount"): bigint {
  if (!input || !/^\d+(\.\d{1,6})?$/.test(input)) {
    fail(`Invalid ${what} "${input ?? ""}" — use a number with at most 6 decimals, e.g. 1000 or 0.1`);
  }
  return parseUnits(input, 6);
}

function parseAddress(input: string | undefined): Address {
  if (!input || !isAddress(input)) fail(`Invalid address "${input ?? ""}"`);
  return input;
}

function reason(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return reverted.reason || reverted.data?.errorName || reverted.shortMessage;
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}

const account = getAccount();
const walletClient = createWalletClient({ account, chain, transport });

async function send(address: Address, abi: typeof usdtAbi | typeof engineAbi, functionName: string, args: unknown[]) {
  // Public RPCs sit behind load balancers, so a node can lag a block behind the
  // tx we just mined and fail simulation/nonce lookup. Retry those (nothing has
  // been broadcast yet); a real contract revert fails immediately.
  let hash: Hex;
  for (let attempt = 1; ; attempt++) {
    try {
      const { request } = await publicClient.simulateContract({
        address,
        abi,
        functionName,
        args,
        account,
      } as never);
      hash = await walletClient.writeContract(request as never);
      break;
    } catch (err) {
      const reverted =
        err instanceof BaseError &&
        err.walk((e) => e instanceof ContractFunctionRevertedError) instanceof ContractFunctionRevertedError;
      if (reverted || attempt === 4) fail(reason(err));
      console.log(`  ${reason(err)} — retrying (${attempt}/3)…`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  console.log(`  tx ${hash}\n  waiting for confirmation…`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    fail(`Transaction reverted on-chain: ${chain.blockExplorers?.default.url}/tx/${hash}`);
  }
  console.log(`  ✔ confirmed in block ${receipt.blockNumber}  ${chain.blockExplorers?.default.url}/tx/${hash}`);
}

async function requireOwner() {
  const owner = await publicClient.readContract({ address: ENGINE, abi: engineAbi, functionName: "owner" });
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    fail(`This key (${account.address}) is not the engine owner (${owner}).`);
  }
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "status": {
    const [owner, price, kyc, poolUsdt, adminUsdt, adminHsk] = await Promise.all([
      publicClient.readContract({ address: ENGINE, abi: engineAbi, functionName: "owner" }),
      publicClient.readContract({ address: ENGINE, abi: engineAbi, functionName: "markPrice" }),
      publicClient.readContract({ address: ENGINE, abi: engineAbi, functionName: "kycEnforced" }),
      publicClient.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [ENGINE] }),
      publicClient.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [account.address] }),
      publicClient.getBalance({ address: account.address }),
    ]);
    console.log(`Network        ${chain.name} (${chain.id})`);
    console.log(`USDT           ${USDT}`);
    console.log(`Engine         ${ENGINE}`);
    console.log(`Owner          ${owner}`);
    console.log(`This key       ${account.address}${owner.toLowerCase() === account.address.toLowerCase() ? "  (owner ✔)" : "  (NOT the owner)"}`);
    console.log(`HSK price      $${usd(price, 4)}`);
    console.log(`KYC enforced   ${kyc ? "yes" : "NO — everyone gets 10x"}`);
    console.log(`Pool           ${usd(poolUsdt)} USDT`);
    console.log(`Admin USDT     ${usd(adminUsdt)}`);
    console.log(`Admin HSK      ${formatUnits(adminHsk, 18)}`);
    break;
  }

  case "send-usdt": {
    const to = parseAddress(args[0]);
    const amount = parseAmount(args[1]);
    const bal = await publicClient.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [account.address] });
    if (amount > bal) fail(`Insufficient USDT: have ${usd(bal)}, sending ${usd(amount)}`);
    console.log(`Sending ${usd(amount)} USDT → ${to}`);
    await send(USDT, usdtAbi, "transfer", [to, amount]);
    break;
  }

  case "set-price": {
    await requireOwner();
    const input = args[0];
    let price: bigint;
    const rel = input?.match(/^([+-]\d+(?:\.\d+)?)%$/);
    if (rel) {
      const current = await publicClient.readContract({ address: ENGINE, abi: engineAbi, functionName: "markPrice" });
      const bps = BigInt(Math.round(Number(rel[1]) * 100)); // % -> basis points
      price = (current * (10_000n + bps)) / 10_000n;
      console.log(`Current $${usd(current, 4)} ${input} → $${usd(price, 4)}`);
    } else {
      price = parseAmount(input, "price");
      console.log(`Setting HSK price to $${usd(price, 4)}`);
    }
    if (price === 0n) fail("Price must be greater than 0.");
    await send(ENGINE, engineAbi, "setPrice", [price]);
    break;
  }

  case "set-tier": {
    await requireOwner();
    const who = parseAddress(args[0]);
    const tier = Number(args[1]);
    if (!Number.isInteger(tier) || tier < 0 || tier > 3) fail("Tier must be 0, 1, 2 or 3.");
    console.log(`Setting KYC tier of ${who} to ${tier}`);
    await send(ENGINE, engineAbi, "setKycTier", [who, tier]);
    break;
  }

  case "kyc": {
    await requireOwner();
    if (args[0] !== "on" && args[0] !== "off") usage();
    console.log(`Turning KYC enforcement ${args[0]}`);
    await send(ENGINE, engineAbi, "toggleKycEnforcement", [args[0] === "on"]);
    break;
  }

  case "deposit": {
    const amount = parseAmount(args[0]);
    const allowance = await publicClient.readContract({ address: USDT, abi: usdtAbi, functionName: "allowance", args: [account.address, ENGINE] });
    if (allowance < amount) {
      console.log(`Approving ${usd(amount)} USDT for the engine`);
      await send(USDT, usdtAbi, "approve", [ENGINE, amount]);
    }
    console.log(`Depositing ${usd(amount)} USDT of liquidity`);
    await send(ENGINE, engineAbi, "depositLiquidity", [amount]);
    break;
  }

  case "liquidate": {
    const who = parseAddress(args[0]);
    console.log(`Liquidating ${who}`);
    await send(ENGINE, engineAbi, "liquidate", [who]);
    break;
  }

  default:
    usage();
}
