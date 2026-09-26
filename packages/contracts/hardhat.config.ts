import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    // HashKey Chain Testnet — chainId 133. Public RPC needs no API key, so
    // only the deployer key is a secret. Matches apps/web's default network
    // (see apps/web/src/lib/chain.ts).
    hashkeyTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://testnet.hsk.xyz",
      accounts: [configVariable("HSK_TESTNET_PRIVATE_KEY")],
    },
    // HashKey Chain Mainnet — chainId 177. Real HSK; only use once you mean it.
    hashkey: {
      type: "http",
      chainType: "l1",
      url: "https://mainnet.hsk.xyz",
      accounts: [configVariable("HSK_MAINNET_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
    // HashKey Chain's explorer is Blockscout-based; hardhat-verify's
    // Blockscout provider auto-discovers the right instance per chain ID
    // and needs no API key for the public API.
    blockscout: {
      enabled: true,
    },
  },
});
