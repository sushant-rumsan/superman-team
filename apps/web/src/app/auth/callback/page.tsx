"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAuth } from "@/app/providers";
import { Spinner } from "@/components/Spinner";

export default function AuthCallbackPage() {
  const { magic, login } = useAuth();
  const router = useRouter();
  // Magic's SDK instance is created client-side after mount, so on a fresh
  // page load `magic` is very often still null on the first render here.
  // `hasRun` stops a second, spurious attempt (e.g. Strict Mode's dev
  // double-invoke) from re-consuming the one-time OAuth result.
  const hasRun = useRef(false);

  useEffect(() => {
    if (!magic || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        const result = await magic.oauth.getRedirectResult();
        if (!result) {
          router.push("/auth");
          return;
        }

        const info = await magic.user.getInfo();
        if (!info.publicAddress) {
          router.push("/auth");
          return;
        }

        login({
          email: info.email ?? null,
          address: info.publicAddress as `0x${string}`,
        });
        router.push("/");
      } catch (error) {
        console.error("Auth callback error:", error);
        router.push("/auth");
      }
    })();
  }, [magic, login, router]);

  return (
    <main className="grid min-h-[100svh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <p className="text-sm text-muted">Finishing sign-in…</p>
      </div>
    </main>
  );
}
