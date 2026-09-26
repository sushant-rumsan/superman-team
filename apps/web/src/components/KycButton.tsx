"use client";

import { useState } from "react";

import { useAuth } from "@/app/providers";
import { startKyc } from "@/lib/kyc";
import { errorMessage } from "@/lib/format";
import { Btn } from "./ui";

/** A single "Verify identity" button. Shown only when signed in; click runs startKyc. */
export function KycButton({ onDone }: { onDone?: () => void }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (auth.status !== "signed-in") return null;

  const onClick = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await startKyc(auth.address);
      onDone?.();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Btn
      variant="info"
      busy={busy}
      onClick={onClick}
      title={error}
      className="rounded-full"
    >
      {error ? "KYC failed · retry" : "Verify KYC"}
    </Btn>
  );
}
