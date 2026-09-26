Use this command to faucet:
npm run admin -w contracts -- send-usdt 0x478b472F3F8ABF9E2d38B3587D12a030BE5b0522 1000

npm run admin -- set-price +10%    

Use this command to set price:



# MarginKey Everywhere

A leveraged HSK/USDT margin trading demo on **HashKey Chain**. Traders open 2x/5x/10x positions against a USDT liquidity pool, with optional KYC tiers and an admin CLI to move the market.

```
apps/web/            Next.js frontend (Google sign-in via Magic)
packages/contracts/  Hardhat project: MarginEngineUSDT, MockUSDT, tests, deploy scripts
```

## Setup

Requires Node.js ≥ 22.10.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp packages/contracts/.env.example packages/contracts/.env
```

Fill in `NEXT_PUBLIC_MAGIC_API_KEY` in `apps/web/.env.local` and `PRIVATE_KEY` (the deployer/owner key) in `packages/contracts/.env`.

## Deploy the contract

```bash
NETWORK=hashkeyTestnet npm run deploy:margin:script
```

This deploys `MockUSDT` and `MarginEngineUSDT`, then seeds the pool with 500,000 test USDT. Addresses are written to `packages/contracts/deployedContracts.json`. Set `NETWORK=localhost` to deploy to a local node (`npm run chain` in another terminal).

Then run the app:

```bash
npm run dev
```
