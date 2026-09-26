"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { txUrl } from "@/lib/config";
import type { TxState } from "@/hooks/useTx";
import { shortAddr } from "@/lib/format";
import { Spinner } from "./Spinner";

export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-surface p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const VARIANTS = {
  primary: "bg-accent text-black hover:brightness-110",
  up: "bg-up text-black hover:brightness-110",
  danger: "bg-down text-black hover:brightness-110",
  info: "bg-accent/15 text-accent hover:bg-accent/25",
  ghost: "bg-surface-3 text-foreground hover:bg-white/15",
} as const;

const SIZES = {
  md: "rounded-xl px-4 py-2.5 text-sm",
  lg: "w-full rounded-2xl px-5 py-4 text-lg",
} as const;

export function Btn({
  variant = "primary",
  size = "md",
  busy,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  busy?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export const inputCls =
  "w-full rounded-xl border border-transparent bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none";

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-sm text-muted">{children}</div>;
}

/** One line of a details list: muted label left, value right. */
export function Row({
  label,
  hint,
  children,
  valueClass = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted" title={hint}>
        {label}
      </span>
      <span className={`text-right font-medium ${valueClass}`}>{children}</span>
    </div>
  );
}

export function Chip({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "neutral" | "up" | "down" | "warn" | "accent";
  children: ReactNode;
  className?: string;
}) {
  const cls = {
    neutral: "bg-surface-2 text-muted",
    up: "bg-up/12 text-up",
    down: "bg-down/12 text-down",
    warn: "bg-warn/12 text-warn",
    accent: "bg-accent/12 text-accent",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls} ${className}`}
    >
      {children}
    </span>
  );
}

/** Inline signing / mining / error / last-tx status for a useTx instance. */
export function TxStatus({ tx }: { tx: TxState }) {
  if (tx.phase === "signing") {
    return <p className="mt-3 text-center text-sm text-warn">Confirm in wallet…</p>;
  }
  if (tx.phase === "mining") {
    return (
      <p className="mt-3 text-center text-sm text-warn">
        Confirming…{" "}
        {tx.hash && (
          <a className="underline" href={txUrl(tx.hash)} target="_blank" rel="noreferrer">
            {shortAddr(tx.hash)}
          </a>
        )}
      </p>
    );
  }
  if (tx.error) {
    return (
      <p className="mt-3 break-words rounded-xl bg-down/10 px-3 py-2 text-sm text-down">
        {tx.error}
      </p>
    );
  }
  if (tx.hash) {
    return (
      <p className="mt-3 text-center text-sm text-up">
        Confirmed ·{" "}
        <a className="underline" href={txUrl(tx.hash)} target="_blank" rel="noreferrer">
          view tx ↗
        </a>
      </p>
    );
  }
  return null;
}

export function Alert({
  tone,
  children,
}: {
  tone: "red" | "amber";
  children: ReactNode;
}) {
  const cls = tone === "red" ? "bg-down/10 text-down" : "bg-warn/10 text-warn";
  return <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${cls}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-2 ${className}`} />;
}
