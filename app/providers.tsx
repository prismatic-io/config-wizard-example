"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * Wraps the app in a React Query client. Every server interaction in this example —
 * loading the instance, fetching page content, polling OAuth connection status,
 * the auth token, and the submit / deploy / disconnect mutations — goes through
 * React Query. Caching, request de-duplication, polling, and retry/backoff are the
 * library's job, not ours; the defaults below are the only async "configuration" in
 * the whole app.
 *
 * Mounted from the (server) root layout — a Client Component is required because
 * React context can't cross the server/client boundary.
 */
export function Providers({ children }: { children: ReactNode }) {
  // Create the client once per mount and keep it in state, so React never throws it
  // away (and its cache with it) on a re-render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Treat fetched data as fresh for a short window. We invalidate
            // explicitly when something changes (e.g. a connection goes ACTIVE), so
            // this just suppresses redundant refetches within one wizard session.
            staleTime: 30_000,
            // Off by default — only the connection-status poll wants focus refetches
            // (it opts in), so returning to the tab never triggers surprise reloads.
            refetchOnWindowFocus: false,
            // The Prismatic API is rate-limited (~20 req/s) and the SDK fires several
            // requests on mount, so transient throttle errors are expected. Retry a
            // couple of times with a gentle backoff instead of surfacing them.
            retry: 2,
            retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 8000),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
