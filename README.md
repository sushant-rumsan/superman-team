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

## Adding your own contract

1. Add `packages/contracts/contracts/YourContract.sol` and a matching Ignition module under `ignition/modules/`.
2. `npm run compile` / `npm test` (see `test/Counter.ts` for the pattern).
3. Point your deploy script at the new module, then `npm run deploy:hsk-testnet`.
4. Import `contracts.YourContract` from `apps/web/src/contracts/generated.ts` in a client component.
