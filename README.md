# superman-team

A full-stack blockchain app seed: **Next.js** (App Router) + **Hardhat 3** (viem + Ignition), wired together for **HashKey Chain**, with **Google sign-in via Magic** as the wallet/auth layer.

```
apps/web/          Next.js frontend
packages/contracts/  Hardhat project (Solidity, tests, deploy scripts)
```

## Prerequisites

- Node.js ≥ 22.10
- A [Magic](https://dashboard.magic.link) app (free) with **Google** enabled under Login Methods → Social

## Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```bash
NEXT_PUBLIC_MAGIC_API_KEY=pk_live_...   # your Magic publishable key
NEXT_PUBLIC_HSK_NETWORK=testnet         # or "mainnet"
```

In the Magic dashboard, add `http://localhost:3000/auth/callback` (and your deployed URL's equivalent) as an allowed OAuth redirect URL.

## Run it locally

```bash
npm run chain           # terminal 1: local Hardhat node (chain 31337)
npm run deploy:local    # terminal 2: deploy Counter.sol + write its address/ABI to apps/web
npm run dev              #             start the Next.js app
```

Open http://localhost:3000, sign in with Google, and click Increment. Note: the local Hardhat node is a different chain (31337) than HashKey — the app's contract calls always target whichever chain `NEXT_PUBLIC_HSK_NETWORK` points at, so for the demo Counter to actually respond, deploy to HashKey testnet instead (below) once you're past initial wiring.

## Deploy contracts to HashKey Chain

```bash
npx hardhat keystore set HSK_TESTNET_PRIVATE_KEY   # one-time: store a deployer key securely
npm run deploy:hsk-testnet                          # deploy + verify + export ABI/address to apps/web
```

`npm run deploy:hsk-testnet` runs Hardhat Ignition, then `packages/contracts/scripts/export-contracts.ts`, which writes every deployed contract's ABI and per-chain address into [`apps/web/src/contracts/generated.ts`](apps/web/src/contracts/generated.ts) — the frontend reads from there, keyed by chain ID, so it automatically picks up whichever network you deployed to.

For mainnet, use `npm run deploy:hsk` with `HSK_MAINNET_PRIVATE_KEY` and `NEXT_PUBLIC_HSK_NETWORK=mainnet`.

Sepolia is also wired up (`npm run deploy:sepolia`, needs `SEPOLIA_RPC_URL`/`SEPOLIA_PRIVATE_KEY`/`ETHERSCAN_API_KEY`) if you want an Ethereum testnet target too — the frontend just won't read from it unless you add Sepolia to `apps/web/src/lib/chain.ts`.

## How auth works

- [`src/lib/magic.ts`](apps/web/src/lib/magic.ts) — lazily creates the Magic SDK singleton, scoped to the configured HashKey network.
- [`src/app/providers.tsx`](apps/web/src/app/providers.tsx) — `AuthContext`/`useAuth()`; tracks the Magic session (rechecked on an interval and on tab focus).
- [`src/app/auth/page.tsx`](apps/web/src/app/auth/page.tsx) — "Continue with Google" button; redirects to Google via `magic.oauth.loginWithRedirect`.
- [`src/app/auth/callback/page.tsx`](apps/web/src/app/auth/callback/page.tsx) — handles the redirect back, resolves the Magic session, calls `login()`.
- [`src/hooks/useWalletClient.ts`](apps/web/src/hooks/useWalletClient.ts) — a viem `WalletClient` backed by the signed-in user's embedded wallet, for sending transactions (see `src/components/Counter.tsx` for a full read+write example).

There's no backend/JWT layer here — Magic's own session (an iframe-backed relayer session) is the source of truth for "is this user signed in." Add a backend token exchange later if you need server-side session verification.

## Deploying the margin engine

`MarginEngineUSDT` has two deploy paths:

- **Script** (curate-ai-contracts style — step-by-step logs, seeds the liquidity pool, writes `packages/contracts/deployedContracts.json` keyed by chain ID):
  ```bash
  cp packages/contracts/.env.example packages/contracts/.env   # set PRIVATE_KEY
  NETWORK=hashkeyTestnet npm run deploy:margin:script          # or NETWORK=localhost
  ```
  It deploys `MockUSDT` (100,000,000 USDT minted to the deployer/admin), then `MarginEngineUSDT` (initial price $0.10 per HSK), then deposits 500,000 test USDT as liquidity. Leave `USDT_ADDRESS` empty in `.env` unless you want to reuse an existing token. On mainnet (`NETWORK=hashkey`) it refuses to deploy a mock and requires `USDT_ADDRESS`.
- **Ignition** (`npm run deploy:margin:hsk-testnet`, etc.) — deploys the same two contracts without seeding, and feeds `npm run export` for the frontend.

## Admin CLI

The deployer key (`PRIVATE_KEY` in `packages/contracts/.env`) is the engine owner. Drive the market from the terminal:

```bash
npm run admin -- status
npm run admin -- send-usdt <address> 1000
npm run admin -- set-price 0.1        # or -10% / +10% relative to the current price
npm run admin -- set-tier <address> 3 # 0 none, 1 = 2x, 2 = 5x, 3 = 10x
npm run admin -- kyc on               # or off
npm run admin -- deposit 5000         # add USDT to the liquidity pool
npm run admin -- liquidate <address>
```

Writes are simulated first (real revert reasons) and only reported as successful once mined.

## Adding your own contract

1. Add `packages/contracts/contracts/YourContract.sol` and a matching Ignition module under `ignition/modules/`.
2. `npm run compile` / `npm test` (see `test/Counter.ts` for the pattern).
3. Point your deploy script at the new module, then `npm run deploy:hsk-testnet`.
4. Import `contracts.YourContract` from `apps/web/src/contracts/generated.ts` in a client component.
