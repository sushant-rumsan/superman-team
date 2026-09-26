"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { getMagic, type Magic } from "@/lib/magic";

type AuthUser = { email: string | null; address: `0x${string}` };

type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | ({ status: "signed-in" } & AuthUser);

type AuthContextType = AuthState & {
  magic: Magic | null;
  /** Called by /auth/callback once Magic's OAuth redirect has resolved. */
  login: (user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  status: "loading",
  magic: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// How often to re-check the Magic session in the background, so a session
// that expires or is revoked mid-visit (no navigation, no API call) is
// still caught.
const SESSION_CHECK_INTERVAL_MS = 60_000;

/** Reads the current Magic session. Never touches React state itself, so
 *  callers control exactly when/whether to apply the result (see the
 *  ignore-flag effect below). */
async function fetchSession(magic: Magic): Promise<AuthState> {
  const loggedIn = await magic.user.isLoggedIn();
  if (!loggedIn) return { status: "signed-out" };

  const info = await magic.user.getInfo();
  if (!info.publicAddress) return { status: "signed-out" };

  return {
    status: "signed-in",
    email: info.email ?? null,
    address: info.publicAddress as `0x${string}`,
  };
}

// Magic never changes once created, so there's nothing to subscribe to —
// but useSyncExternalStore's real job here is the getServerSnapshot split:
// it renders `null` on the server *and* on the client's first (hydration)
// render, then swaps to the real client-only singleton right after. A plain
// `useState(() => getMagic())` looks equivalent but isn't — its initializer
// re-runs on the client's first render too, so it returns the real instance
// immediately, before hydration reconciles, which is a genuine mismatch
// (e.g. a `disabled={!magic}` button renders differently server vs. client).
const noopSubscribe = () => () => {};
const getServerSnapshot = () => null;

export function Providers({ children }: { children: ReactNode }) {
  const magic = useSyncExternalStore(noopSubscribe, getMagic, getServerSnapshot);
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    if (!magic) return;
    let ignore = false;

    const check = () => {
      fetchSession(magic)
        .catch((error) => {
          console.error("Magic session check failed:", error);
          return { status: "signed-out" } as const;
        })
        .then((next) => {
          if (!ignore) setState(next);
        });
    };

    check();
    const interval = setInterval(check, SESSION_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ignore = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [magic]);

  const login = useCallback((user: AuthUser) => {
    setState({ status: "signed-in", ...user });
  }, []);

  const logout = useCallback(() => {
    setState({ status: "signed-out" });
    magic?.user.logout().catch((error) => {
      console.error("Magic logout failed:", error);
    });
  }, [magic]);

  return (
    <AuthContext.Provider value={{ ...state, magic, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
