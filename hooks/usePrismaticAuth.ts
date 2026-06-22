"use client";

import { useQuery } from "@tanstack/react-query";
import prismatic from "@prismatic-io/embedded";
import { prismaticKeys } from "@/lib/prismatic";

export type PrismaticAuthStatus =
  | "initializing"
  | "authenticated"
  | "needs-credentials" // token route returned 503 — signing key not set
  | "error";

interface PrismaticAuth {
  status: PrismaticAuthStatus;
  authenticated: boolean;
  error: Error | null;
  /** The current embedded JWT — used to exchange avatar URLs for presigned URLs. */
  token: string | null;
}

type TokenResult =
  | { kind: "authenticated"; token: string; expiresAt: number }
  | { kind: "needs-credentials" };

// The SDK touches window/document, so initialize it exactly once on the client.
let initialized = false;
function ensureInit() {
  if (!initialized) {
    prismatic.init();
    initialized = true;
  }
}

/** Fetch a signed JWT from our server route and hand it to the embedded SDK. */
async function fetchAndAuthenticate(): Promise<TokenResult> {
  ensureInit();
  const res = await fetch("/api/integration-token");
  // 503 = the signing key isn't configured. Not an error — a distinct UI state.
  if (res.status === 503) return { kind: "needs-credentials" };
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);

  const { token, expiresAt } = (await res.json()) as {
    token: string;
    expiresAt: number;
  };
  await prismatic.authenticate({ token });
  return { kind: "authenticated", token, expiresAt };
}

/** Refresh ~60s before the JWT expires, but never schedule sooner than 30s out. */
function msUntilRefresh(expiresAt: number): number {
  return Math.max(expiresAt * 1000 - Date.now() - 60_000, 30_000);
}

/**
 * One shared auth session for the whole app. React Query keys this query by a single
 * constant (`prismaticKeys.token()`), so every component that calls this hook reuses
 * the same in-flight request and cached token. `refetchInterval` re-authenticates just
 * before the token expires; that is the only thing that re-runs auth.
 *
 * Must run in a Client Component: the SDK uses `window`/`document`.
 */
export function usePrismaticAuth(): PrismaticAuth {
  const query = useQuery({
    queryKey: prismaticKeys.token(),
    queryFn: fetchAndAuthenticate,
    enabled: typeof window !== "undefined",
    // Re-auth shortly before expiry. The timer fires even in a backgrounded tab so
    // the session never silently lapses; returning `false` stops it (e.g. when the
    // signing key isn't configured, so there's nothing to refresh).
    refetchInterval: (q) =>
      q.state.data?.kind === "authenticated"
        ? msUntilRefresh(q.state.data.expiresAt)
        : false,
    refetchIntervalInBackground: true,
    // The token IS the session — keep it cached and don't refetch on focus/remount.
    // The refresh interval is the single source of re-authentication.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  if (query.isError) {
    return {
      status: "error",
      authenticated: false,
      error:
        query.error instanceof Error
          ? query.error
          : new Error(String(query.error)),
      token: null,
    };
  }
  if (query.data?.kind === "needs-credentials") {
    return {
      status: "needs-credentials",
      authenticated: false,
      error: null,
      token: null,
    };
  }
  if (query.data?.kind === "authenticated") {
    return {
      status: "authenticated",
      authenticated: true,
      error: null,
      token: query.data.token,
    };
  }
  return { status: "initializing", authenticated: false, error: null, token: null };
}
