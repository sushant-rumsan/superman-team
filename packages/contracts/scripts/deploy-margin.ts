/**
 * Deploys the margin trading stack (MockUSDT + MarginEngineUSDT), seeds the
 * liquidity pool, and records the addresses in deployedContracts.json.
 *
 * Standalone script in the style of curate-ai-contracts/scripts/deploy.ts:
 * raw artifacts + an RPC URL + a private key, no Hardhat network runtime.
 *
 *   NETWORK=hashkeyTestnet npm run deploy:margin:script
 *
 * NETWORK     localhost | hashkeyTestnet (default) | hashkey
 * PRIVATE_KEY deployer key (required, except on localhost where the node's
 *             first unlocked account is used)
 * PROVIDED_URL   optional RPC override for the chosen network
 * USDT_ADDRESS   use an existing USDT instead of deploying MockUSDT. Required
 *             on mainnet; the liquidity seed is skipped since it would spend
 *             real funds.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, hashkey, hashkeyTestnet } from "viem/chains";

const root = path.resolve(import.meta.dirname, "..");
if (existsSync(path.join(root, ".env"))) {
  process.loadEnvFile(path.join(root, ".env"));
}

const CHAINS = { localhost: hardhat, hashkeyTestnet, hashkey } as const;

const INITIAL_PRICE = 100_000n; // $0.10 per HSK (6 decimals)
const LIQUIDITY_SEED = 500_000n * 1_000_000n; // 500,000 USDT (6 decimals)

const networkName = (process.env.NETWORK || "hashkeyTestnet") as keyof typeof CHAINS;
const chain = CHAINS[networkName];
if (!chain) {
  throw new Error(
    `Unknown NETWORK "${networkName}". Use one of: ${Object.keys(CHAINS).join(", ")}`,
  );
}

const usdtOverride = process.env.USDT_ADDRESS as Address | undefined;
if (networkName === "hashkey" && !usdtOverride) {
  throw new Error(
    "Refusing to deploy a mock USDT to mainnet — set USDT_ADDRESS to the real token.",
  );
}

const transport = http(process.env.PROVIDED_URL || chain.rpcUrls.default.http[0]);
const publicClient = createPublicClient({ chain, transport });

async function getDeployer() {
  if (process.env.PRIVATE_KEY) {
    return privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  }
  if (networkName === "localhost") {
    const [first] = await createWalletClient({ chain, transport }).getAddresses();
    if (!first) throw new Error("The local node has no unlocked accounts.");
    return first;
  }
  throw new Error("PRIVATE_KEY is required for this network (see .env.example).");
}

async function loadArtifact(sourceFile: string, contractName: string) {
  const file = path.join(
    root,
    "artifacts/contracts",
    sourceFile,
    `${contractName}.json`,
  );
  const { abi, bytecode } = JSON.parse(await readFile(file, "utf8")) as {
    abi: Abi;
    bytecode: Hex;
  };
  return { abi, bytecode };
}

export const deployMargin = async () => {
  const deployer = await getDeployer();
  const walletClient = createWalletClient({ account: deployer, chain, transport });
  const deployerAddress = typeof deployer === "string" ? deployer : deployer.address;

  const deploy = async (
    artifact: { abi: Abi; bytecode: Hex },
    args: unknown[] = [],
  ) => {
    const hash = await walletClient.deployContract({ ...artifact, args } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.contractAddress as Address;
  };

  const send = async (
    address: Address,
    abi: Abi,
    functionName: string,
    args: unknown[],
  ) => {
    // Public RPCs sit behind load balancers, so a node can lag a block behind
    // the one that just mined our deployment and fail gas estimation against
    // a contract it can't see yet (curate's deploy.ts papers over this with
    // fixed delays). Estimation fails before anything is broadcast, so
    // retrying here can't double-send.
    let hash: Hex;
    for (let attempt = 1; ; attempt++) {
      try {
        hash = await walletClient.writeContract({
          address,
          abi,
          functionName,
          args,
        } as never);
        break;
      } catch (error) {
        if (attempt === 5) throw error;
        console.log(`  ${functionName} failed (attempt ${attempt}/5), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
    // Deliberately outside the retry loop: once we have a hash the tx is
    // broadcast, and re-sending it would double-spend.
    await publicClient.waitForTransactionReceipt({ hash });
  };

  console.log(`Deploying to ${chain.name} (chain ${chain.id})...`);
  console.log("Deployer:", deployerAddress);

  // Step 1: USDT (deploy a mock unless an existing token was supplied)
  const mockUsdt = await loadArtifact("MockUSDT.sol", "MockUSDT");
  let usdtAddress: Address;
  if (usdtOverride) {
    usdtAddress = usdtOverride;
    console.log("Using existing USDT contract:", usdtAddress);
  } else {
    console.log("Deploying MockUSDT contract...");
    usdtAddress = await deploy(mockUsdt);
    console.log("Deployed MockUSDT contract:", usdtAddress);
  }

  // Step 2: Margin engine
  console.log("Deploying MarginEngineUSDT contract...");
  const marginEngine = await loadArtifact("MarginEngineUSDT.sol", "MarginEngineUSDT");
  const marginEngineAddress = await deploy(marginEngine, [usdtAddress, INITIAL_PRICE]);
  console.log("Deployed MarginEngineUSDT contract:", marginEngineAddress);

  // Step 3: Seed the liquidity pool so profitable positions can be paid out.
  // MockUSDT's constructor already minted the deployer (admin) 100,000,000 USDT.
  if (usdtOverride) {
    console.log(
      "Skipping liquidity seed (real USDT). Approve the engine and call depositLiquidity() yourself.",
    );
  } else {
    console.log("Seeding liquidity pool...");
    await send(usdtAddress, mockUsdt.abi, "approve", [marginEngineAddress, LIQUIDITY_SEED]);
    await send(marginEngineAddress, marginEngine.abi, "depositLiquidity", [LIQUIDITY_SEED]);
    console.log(`Deposited ${LIQUIDITY_SEED / 1_000_000n} USDT of liquidity`);
  }

  // Step 4: Write contract addresses to a file, keyed by chain ID so
  // deploying to one network doesn't wipe another's entry.
  console.log("Writing to deployment file...");
  const outFile = path.join(root, "deployedContracts.json");
  const existing = existsSync(outFile)
    ? JSON.parse(await readFile(outFile, "utf8"))
    : {};
  existing[chain.id] = {
    network: chain.name,
    deployer: deployerAddress,
    usdt: usdtAddress,
    marginEngine: marginEngineAddress,
  };
  await writeFile(outFile, JSON.stringify(existing, null, 2) + "\n");

  console.log("Deployment successful!");
};

await deployMargin();
