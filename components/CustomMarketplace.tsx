"use client";

import { useEffect } from "react";
import { PrismaticMessageEvent } from "@prismatic-io/embedded";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrismaticAuth } from "@/hooks/usePrismaticAuth";
import {
  fetchMarketplaceIntegrations,
  groupInstancesByIntegration,
} from "@/lib/marketplace";
import { fetchCustomerInstances, prismaticKeys } from "@/lib/prismatic";
import { IntegrationCard } from "@/components/IntegrationCard";

/**
 * Fully custom marketplace UI: queries `marketplaceIntegrations` and the
 * customer's instances via the embedded SDK, groups the instances per
 * integration, and renders our own cards. Two `useQuery`s handle fetching,
 * caching, and de-duplication; the mutations (create/delete/pause/deploy)
 * invalidate the same keys, so statuses stay current.
 */
export function CustomMarketplace() {
  const { authenticated, status, token } = usePrismaticAuth();
  const queryClient = useQueryClient();

  const integrationsQuery = useQuery({
    queryKey: prismaticKeys.marketplace(),
    queryFn: fetchMarketplaceIntegrations,
    enabled: authenticated,
  });

  const instancesQuery = useQuery({
    queryKey: prismaticKeys.instances(),
    queryFn: fetchCustomerInstances,
    enabled: authenticated,
  });

  // Refresh when a Prismatic-hosted surface (iframe/popup) reports a deploy or
  // delete. Our own custom wizard and marketplace mutations don't emit these
  // messages — they invalidate the query keys directly instead.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const evt = event.data?.event;
      if (
        evt === PrismaticMessageEvent.INSTANCE_DEPLOYED ||
        evt === PrismaticMessageEvent.INSTANCE_DELETED
      ) {
        void queryClient.invalidateQueries({
          queryKey: prismaticKeys.marketplace(),
        });
        void queryClient.invalidateQueries({
          queryKey: prismaticKeys.instances(),
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient]);

  if (!authenticated) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Waiting for authentication… (status: {status})
      </p>
    );
  }

  if (integrationsQuery.isLoading || instancesQuery.isLoading) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Loading integrations…
      </p>
    );
  }

  const error = integrationsQuery.error ?? instancesQuery.error;
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        Failed to load integrations:{" "}
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  const integrations = integrationsQuery.data ?? [];
  if (integrations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
        No marketplace integrations are available to this customer yet. Publish an
        integration and mark it available in the marketplace to see it here.
      </div>
    );
  }

  const grouped = groupInstancesByIntegration(
    integrations,
    instancesQuery.data ?? [],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {integrations.map((integration) => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          instances={grouped.get(integration.id) ?? []}
          token={token}
        />
      ))}
    </div>
  );
}
