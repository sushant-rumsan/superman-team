"use client";

import Link from "next/link";

import { useAuth } from "@/app/providers";

export function AuthButton() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />;
  }

  if (auth.status === "signed-out") {
    return (
      <Link
        href="/auth"
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Sign in with Google
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span>{auth.email ?? "Signed in"}</span>
      <span className="font-mono text-zinc-500">
        {auth.address.slice(0, 6)}…{auth.address.slice(-4)}
      </span>
      <button
        onClick={auth.logout}
        className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Sign out
      </button>
    </div>
  );
}
