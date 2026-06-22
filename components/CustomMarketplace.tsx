"use client";

import { useEffect } from "react";
import { PrismaticMessageEvent } from "@prismatic-io/embedded";
import { useQuery } from "@tanstack/react-query";
import { usePrismaticAuth } from "@/hooks/usePrismaticAuth";
import { fetchMarketplaceIntegrations } from "@/lib/marketplace";
import { prismaticKeys } from "@/lib/prismatic";
import { IntegrationCard } from "@/components/IntegrationCard";

/**
 * Fully custom marketplace UI: queries `marketplaceIntegrations` via the embedded SDK
 * and renders our own cards. Configuration is delegated to Prismatic's config wizard
 * from each card. A single `useQuery` handles fetching, caching, and de-duplication —
 * we just call `refetch()` whenever an instance is deployed or deleted so statuses
 * stay current (no `fetchedRef` guard, no manual loading/error state).
 */
export function CustomMarketplace() {
  const { authenticated, status, token } = usePrismaticAuth();

  const {
    data: integrations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: prismaticKeys.marketplace(),
    queryFn: fetchMarketplaceIntegrations,
    enabled: authenticated,
  });

  // Refetch when the config wizard reports a deploy/delete.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const evt = event.data?.event;
      if (
        evt === PrismaticMessageEvent.INSTANCE_DEPLOYED ||
        evt === PrismaticMessageEvent.INSTANCE_DELETED
      ) {
        void refetch();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refetch]);

  if (!authenticated) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Waiting for authentication… (status: {status})
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Loading integrations…
      </p>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        Failed to load integrations:{" "}
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
        No marketplace integrations are available to this customer yet. Publish an
        integration and mark it available in the marketplace to see it here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {integrations.map((integration) => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          token={token}
          onMutated={() => void refetch()}
        />
      ))}
    </div>
  );
}
