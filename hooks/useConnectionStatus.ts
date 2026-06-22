"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOauth2ConnectionStatuses, prismaticKeys } from "@/lib/prismatic";

interface UseConnectionStatusOptions {
  /** Config-var keys (CONNECTION type) to watch on the current page. */
  connectionKeys: string[];
  /** ISO timestamp passed to the query's `$startedAt` log filter. */
  startedAt: string;
  /** Poll cadence in ms while a watched connection is still pending. */
  intervalMs?: number;
}

interface UseConnectionStatus {
  /** Live config-var status keyed by requiredConfigVariable.key. */
  statuses: Record<string, string | null>;
  /** Force an immediate refetch (e.g. right after the user clicks Authorize). */
  refresh: () => void;
}

/**
 * Polls instance config-variable statuses so the wizard can watch an OAuth connection
 * flip to "ACTIVE" after the user authorizes in a separate tab.
 *
 * This is a plain React Query poll: `refetchInterval` returns the cadence while any
 * watched key is still pending and `false` once they're all "ACTIVE", so polling
 * self-stops. React Query already pauses background tabs (`refetchIntervalInBackground`
 * defaults off) and refetches on window focus (the "came back from the OAuth tab"
 * path).
 */
export function useConnectionStatus(
  instanceId: string,
  { connectionKeys, startedAt, intervalMs = 3000 }: UseConnectionStatusOptions,
): UseConnectionStatus {
  const query = useQuery({
    queryKey: prismaticKeys.connectionStatuses(instanceId, startedAt),
    queryFn: () => fetchOauth2ConnectionStatuses(instanceId, startedAt),
    // Only poll when there's a connection on the page to watch.
    enabled: connectionKeys.length > 0,
    // Poll until every watched connection is ACTIVE, then stop.
    refetchInterval: (q) => {
      const statuses = q.state.data ?? {};
      const allActive = connectionKeys.every((k) => statuses[k] === "ACTIVE");
      return allActive ? false : intervalMs;
    },
    // The OAuth flow happens in another tab; refetch the moment the user returns.
    refetchOnWindowFocus: true,
    // Status is live — never treat a cached value as fresh.
    staleTime: 0,
  });

  return {
    statuses: query.data ?? {},
    refresh: () => void query.refetch(),
  };
}
