"use client";

import { useState } from "react";

import type { Session } from "@/hooks/useSession";
import { hskChain } from "@/lib/chain";
import { ENGINE, USDT } from "@/lib/config";
import { FUND_AMOUNT_HSK } from "@/lib/fund";
import { errorMessage } from "@/lib/format";
import { Alert, Btn } from "./ui";

export function StatusBanners({ s }: { s: Session }) {
  const [switchError, setSwitchError] = useState<string>();

  return (
    <>
      {(!ENGINE || !USDT) && (
        <Alert tone="red">
          NEXT_PUBLIC_ENGINE / NEXT_PUBLIC_USDT are not set — add them to apps/web/.env.local and
          restart.
        </Alert>
      )}
      {s.wrongNetwork && (
        <Alert tone="red">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>
              Wrong network (chain {s.walletChain}) — switch to {hskChain.name} ({hskChain.id})
            </span>
            <Btn
              variant="danger"
              onClick={() =>
                s.walletClient
                  ?.switchChain({ id: hskChain.id })
                  .then(() => setSwitchError(undefined))
                  .catch((e) => setSwitchError(errorMessage(e)))
              }
            >
              Switch to {hskChain.id}
            </Btn>
          </div>
          {switchError && <div className="mt-2 font-mono text-base">{switchError}</div>}
        </Alert>
      )}
      {s.noGas && s.funding.phase === "pending" && (
        <Alert tone="amber">Funding your new wallet with {FUND_AMOUNT_HSK} HSK for gas…</Alert>
      )}
      {s.noGas && s.funding.phase !== "pending" && (
        <Alert tone="amber">
          No HSK for gas — send testnet HSK to {s.account} before making transactions.
          {s.funding.phase === "error" && (
            <div className="mt-1 font-mono text-base">Auto-funding failed: {s.funding.error}</div>
          )}
        </Alert>
      )}
      {s.error && <Alert tone="amber">RPC error reading chain state: {s.error}</Alert>}
    </>
  );
}
