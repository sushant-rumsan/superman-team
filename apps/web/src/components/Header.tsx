"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/providers";
import type { Market } from "@/hooks/useMarket";
import { useTx } from "@/hooks/useTx";
import { USDT, usdtAbi } from "@/lib/config";
import { fmtHsk, fmtUsdt, shortAddr } from "@/lib/format";
import { KycButton } from "./KycButton";
import { Btn, TxStatus } from "./ui";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function AccountMenu({
  market,
  canTx,
  refresh,
}: {
  market?: Market;
  canTx: boolean;
  refresh: () => void;
}) {
  const auth = useAuth();
  const faucet = useTx(refresh);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (auth.status !== "signed-in") return null;

  const copy = () => {
    navigator.clipboard
      ?.writeText(auth.address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-4 pr-1.5 text-sm font-medium transition hover:bg-surface-3"
      >
        <span className="hidden sm:inline">{market ? `${fmtUsdt(market.usdt)} USDT` : "…"}</span>
        <span className="flex items-center gap-2 rounded-full bg-surface-3 px-3 py-1.5">
          <span className="h-4 w-4 rounded-full bg-gradient-to-br from-accent to-info" />
          {shortAddr(auth.address)}
        </span>
      </button>

      {open && (
        <div className="pop-in absolute right-0 z-20 mt-2 w-80 rounded-3xl border border-line bg-surface p-4 shadow-2xl shadow-black/60">
          <div className="text-sm text-muted">{auth.email ?? "Signed in"}</div>
          <button
            onClick={copy}
            className="mt-0.5 font-mono text-sm hover:text-accent"
            title="Copy address"
          >
            {copied ? "Copied ✓" : shortAddr(auth.address)}
          </button>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">USDT</div>
              <div className="text-lg font-semibold">{market ? fmtUsdt(market.usdt) : "…"}</div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">HSK (gas)</div>
              <div className="text-lg font-semibold">{market ? fmtHsk(market.hsk) : "…"}</div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Btn
              variant="info"
              className="flex-1"
              busy={faucet.busy}
              disabled={!canTx || !USDT}
              onClick={() =>
                USDT && faucet.run({ address: USDT, abi: usdtAbi, functionName: "faucet" })
              }
            >
              Get test USDT
            </Btn>
            <Btn variant="ghost" onClick={auth.logout}>
              Sign out
            </Btn>
          </div>
          <TxStatus tx={faucet} />
        </div>
      )}
    </div>
  );
}

export function Header({
  market,
  canTx,
  refresh,
}: {
  market?: Market;
  canTx: boolean;
  refresh: () => void;
}) {
  const auth = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-black text-black">
              S
            </span>
            <span className="hidden sm:inline">Superman</span>
          </Link>
          <nav className="flex items-center">
            <NavLink href="/">Trade</NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-surface-2 px-3 py-1.5 text-xs text-muted md:inline">
            HashKey Testnet
          </span>
          {auth.status === "signed-in" ? (
            <>
              <KycButton onDone={refresh} />
              <AccountMenu market={market} canTx={canTx} refresh={refresh} />
            </>
          ) : auth.status === "signed-out" ? (
            <Link
              href="/auth"
              className="rounded-full bg-accent/15 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/25"
            >
              Sign in
            </Link>
          ) : (
            <div className="h-9 w-24 animate-pulse rounded-full bg-surface-2" />
          )}
        </div>
      </div>
    </header>
  );
}
