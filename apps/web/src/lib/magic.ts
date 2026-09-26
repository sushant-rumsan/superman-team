import { OAuthExtension } from "@magic-ext/oauth";
import { Magic as MagicBase } from "magic-sdk";

import { hskChain } from "./chain";

export type Magic = MagicBase<OAuthExtension[]>;

let magic: Magic | undefined;

/**
 * Lazily creates the Magic SDK singleton. Must only be called in the
 * browser (Magic's SDK reaches for `window`/iframes at construction time),
 * so every caller does so from a "use client" component inside an effect.
 */
export function getMagic(): Magic | null {
  if (typeof window === "undefined") return null;

  if (!magic) {
    const apiKey = process.env.NEXT_PUBLIC_MAGIC_API_KEY;
    if (!apiKey) {
      console.error(
        "NEXT_PUBLIC_MAGIC_API_KEY is not set — copy apps/web/.env.example to .env.local and add your Magic publishable key.",
      );
      return null;
    }

    magic = new MagicBase(apiKey, {
      network: {
        rpcUrl: hskChain.rpcUrls.default.http[0],
        chainId: hskChain.id,
      },
      extensions: [new OAuthExtension()],
    });
  }

  return magic;
}
