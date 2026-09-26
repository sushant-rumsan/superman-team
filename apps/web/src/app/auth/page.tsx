"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { Spinner } from "@/components/Spinner";

/** Google "G" in a single colour so it inherits the button's text colour. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.51h5.84c-.25 1.37-1.02 2.53-2.17 3.3v2.74h3.51c2.06-1.9 3.28-4.7 3.28-8.3z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.51-2.74c-1.01.68-2.3 1.09-3.77 1.09-2.89 0-5.33-1.95-6.2-4.57H2.18v2.88C4 20.36 7.74 23 12 23z" />
      <path d="M5.8 14.06c-.22-.68-.35-1.41-.35-2.16s.13-1.48.35-2.16V6.86H2.18C1.44 8.3 1 9.97 1 11.9s.44 3.6 1.18 5.04l3.62-2.88z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 15.02 1 12 1 7.74 1 4 3.64 2.18 6.86l3.62 2.88c.87-2.62 3.31-4.57 6.2-4.57z" />
    </svg>
  );
}

export default function AuthPage() {
  const { status, magic } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Already signed in → move along.
  useEffect(() => {
    if (status === "signed-in") router.push("/");
  }, [status, router]);

  const onGoogle = async () => {
    if (loading || !magic) return;
    setError(false);
    setLoading(true);
    try {
      // Full-page redirect to Google; the app returns to /auth/callback.
      await magic.oauth.loginWithRedirect({
        provider: "google",
        redirectURI: `${window.location.origin}/auth/callback`,
      });
    } catch (err) {
      console.error("Google login error:", err);
      setError(true);
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-[100svh] place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-xl font-black text-black">
          S
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Welcome to Superman</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with Google to start margin trading. No wallet setup needed.
        </p>

        <button
          type="button"
          onClick={onGoogle}
          disabled={loading || !magic}
          className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-surface-2 font-semibold transition-colors hover:bg-surface-3 disabled:cursor-default disabled:opacity-50"
        >
          {loading ? (
            <Spinner />
          ) : (
            <>
              <GoogleG className="h-5 w-5" />
              Continue with Google
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-sm text-down">
            Something went wrong. Try again.
          </p>
        )}
      </div>
    </main>
  );
}
