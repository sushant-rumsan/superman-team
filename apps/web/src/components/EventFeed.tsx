"use client";

import type { FeedEvent } from "@/hooks/useEvents";
import { ASSET, txUrl } from "@/lib/config";
import { fmtPrice, fmtSigned, fmtUsdt, shortAddr } from "@/lib/format";

const STYLE = {
  opened: { label: "Opened long", dot: "bg-up" },
  closed: { label: "Closed", dot: "bg-info" },
  liquidated: { label: "Liquidated", dot: "bg-down" },
  price: { label: "Price update", dot: "bg-warn" },
} as const;

function describe(e: FeedEvent): string {
  switch (e.kind) {
    case "opened":
      return `${e.leverage}x · $${fmtUsdt(e.collateral ?? 0n)} collateral · $${fmtUsdt(e.size ?? 0n)} size`;
    case "closed":
      return `PnL ${fmtSigned(e.pnl ?? 0n)} · payout $${fmtUsdt(e.payout ?? 0n)}`;
    case "liquidated":
      return `Seized $${fmtUsdt(e.seized ?? 0n)} · by ${shortAddr(e.liquidator ?? "0x")}`;
    case "price":
      return `${ASSET} → $${fmtPrice(e.price ?? 0n)}`;
  }
}

export function EventFeed({
  events,
  error,
  account,
}: {
  events: FeedEvent[];
  error?: string;
  account?: string;
}) {
  return (
    <section className="pt-4">
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Recent activity</h2>
      {error && <p className="mb-2 px-1 text-sm text-warn">Event feed error: {error}</p>}
      {events.length === 0 && !error && (
        <p className="px-1 text-sm text-muted">Nothing yet — trades will show up here live.</p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {events.slice(0, 15).map((e) => {
          const s = STYLE[e.kind];
          const mine = account && e.who?.toLowerCase() === account.toLowerCase();
          return (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {s.label}
                  <span className="text-xs font-normal text-muted">
                    {e.who ? (mine ? "you" : shortAddr(e.who)) : "owner"}
                  </span>
                </div>
                <div className="truncate text-xs text-muted">{describe(e)}</div>
              </div>
              <a
                href={txUrl(e.tx)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs text-muted hover:text-accent"
              >
                tx ↗
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
