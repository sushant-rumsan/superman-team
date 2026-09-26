"use client";

import { useState } from "react";

import { useEvents } from "@/hooks/useEvents";
import { useSession } from "@/hooks/useSession";
import { EventFeed } from "./EventFeed";
import { Header } from "./Header";
import { MarketBar } from "./MarketBar";
import { PositionPanel } from "./PositionPanel";
import { StatusBanners } from "./StatusBanners";
import { TradePanel } from "./TradePanel";

type Tab = "trade" | "position";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function Terminal() {
  const s = useSession();
  const { market, account, signedIn, canTx, refresh } = s;
  const { events, error: eventsError } = useEvents(refresh);

  const hasPosition = !!market?.position.isOpen;
  // Follow the position: show it when one opens, go back to trading when it closes.
  // A manual tab pick sticks until the next open/close.
  const [picked, setPicked] = useState<Tab | null>(null);
  const [prevHasPosition, setPrevHasPosition] = useState(hasPosition);
  if (prevHasPosition !== hasPosition) {
    setPrevHasPosition(hasPosition);
    setPicked(null);
  }
  const tab: Tab = picked ?? (hasPosition ? "position" : "trade");

  return (
    <div className="flex flex-1 flex-col">
      <Header market={market} canTx={canTx} refresh={refresh} />

      <main className="mx-auto w-full max-w-[30rem] flex-1 space-y-4 px-4 pb-16 pt-8">
        <StatusBanners s={s} />
        <MarketBar market={market} signedIn={signedIn} />

        <section className="rounded-3xl border border-line bg-surface p-3 shadow-2xl shadow-black/40">
          <div className="mb-3 flex gap-1">
            <TabButton active={tab === "trade"} onClick={() => setPicked("trade")}>
              Long
            </TabButton>
            <TabButton active={tab === "position"} onClick={() => setPicked("position")}>
              Position
              {hasPosition && (
                <span
                  className={`h-2 w-2 rounded-full ${market?.liquidatable ? "bg-down" : "bg-up"}`}
                />
              )}
            </TabButton>
          </div>

          {tab === "trade" ? (
            <TradePanel market={market} signedIn={signedIn} canTx={canTx} refresh={refresh} />
          ) : market?.position.isOpen ? (
            <PositionPanel market={market} canTx={canTx} refresh={refresh} />
          ) : (
            <div className="rounded-2xl bg-surface-2 px-5 py-10 text-center">
              <p className="text-muted">No open position.</p>
              <button
                onClick={() => setPicked("trade")}
                className="mt-3 text-sm font-semibold text-accent hover:underline"
              >
                Open a long →
              </button>
            </div>
          )}
        </section>

        <p className="px-4 text-center text-xs text-muted">
          Long-only margin trading. Your loss is capped at your collateral; positions liquidate at a
          90% loss.
        </p>

        <EventFeed events={events} error={eventsError} account={account} />
      </main>
    </div>
  );
}
