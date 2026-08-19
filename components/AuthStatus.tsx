"use client";

import { usePrismaticAuth, type PrismaticAuthStatus } from "@/hooks/usePrismaticAuth";

const COPY: Record<
  PrismaticAuthStatus,
  { dot: string; label: string; detail: string }
> = {
  initializing: {
    dot: "bg-yellow-400",
    label: "Connecting to Prismatic…",
    detail: "Initializing the SDK and requesting a token.",
  },
  authenticated: {
    dot: "bg-green-500",
    label: "Authenticated",
    detail: "The embedded SDK has a valid session. Marketplace calls will work.",
  },
  "needs-credentials": {
    dot: "bg-orange-400",
    label: "Needs credentials",
    detail:
      "Add PRISMATIC_SIGNING_KEY and PRISMATIC_ORG_ID to .env.local, then restart the dev server.",
  },
  error: {
    dot: "bg-red-500",
    label: "Authentication error",
    detail: "Check the browser console and the /api/integration-token response.",
  },
};

/**
 * Renders the live Prismatic auth state. Mounting this also drives the SDK auth
 * lifecycle via usePrismaticAuth, so it doubles as the app's auth bootstrap.
 */
export function AuthStatus() {
  const { status, error } = usePrismaticAuth();
  const copy = COPY[status];

  return (
    <div className="rounded-lg border border-black/10 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${copy.dot}`} />
        {copy.label}
      </div>
      <p className="mt-1 text-black/60">{copy.detail}</p>
      {error && (
        <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-xs">
          {error.message}
        </pre>
      )}
    </div>
  );
}
