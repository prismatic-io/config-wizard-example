"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { usePrismaticAuth } from "@/hooks/usePrismaticAuth";
import {
  fetchMarketplaceIntegrations,
  groupInstancesByIntegration,
  instanceDisplayStatus,
  instanceUpdateAvailability,
  resolveAvatarUrl,
  type MarketplaceIntegration,
} from "@/lib/marketplace";
import {
  deleteInstance,
  fetchCustomerInstances,
  prismaticKeys,
  setInstanceEnabled,
  updateInstanceVersion,
  type InstanceSummary,
} from "@/lib/prismatic";
import { formatShortDate } from "@/lib/format";
import { Avatar } from "@/components/IntegrationCard";
import { InstanceStatusIcon } from "@/components/InstanceStatusIcon";
import { NewInstanceDialog } from "@/components/NewInstanceDialog";

/**
 * The "View All" page for one marketplace integration: every instance the
 * customer has, with per-instance configure / pause / resume / update / delete.
 * Reads come from the same two queries the marketplace grid uses (usually cache
 * hits); mutations invalidate those keys so both pages stay current.
 */
export function IntegrationDetail({ integrationId }: { integrationId: string }) {
  const { authenticated, status, token } = usePrismaticAuth();
  const [adding, setAdding] = useState(false);

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

  if (!authenticated) {
    return (
      <p className="text-sm text-black/60">
        Waiting for authentication… (status: {status})
      </p>
    );
  }

  if (integrationsQuery.isLoading || instancesQuery.isLoading) {
    return (
      <p className="text-sm text-black/60">Loading…</p>
    );
  }

  const error = integrationsQuery.error ?? instancesQuery.error;
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        Failed to load: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  const integrations = integrationsQuery.data ?? [];
  const integration = integrations.find((i) => i.id === integrationId);
  if (!integration) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-black/60">
          This integration isn&rsquo;t available in the marketplace.
        </p>
        <BackLink />
      </div>
    );
  }

  const instances =
    groupInstancesByIntegration(integrations, instancesQuery.data ?? []).get(
      integration.id,
    ) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <Header integration={integration} token={token}>
        {integration.allowMultipleMarketplaceInstances && (
          <button
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5"
          >
            Add Integration
            <Plus size={14} />
          </button>
        )}
      </Header>

      {instances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-black/60">
          No instances created yet.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
          {instances.map((instance) => (
            <InstanceRow key={instance.id} instance={instance} />
          ))}
        </div>
      )}

      {adding && (
        <NewInstanceDialog
          integration={integration}
          existingCount={instances.length}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/integrations"
      className="flex w-fit items-center gap-1 text-sm text-black/60 hover:text-black"
    >
      <ArrowLeft size={14} />
      All integrations
    </Link>
  );
}

function Header({
  integration,
  token,
  children,
}: {
  integration: MarketplaceIntegration;
  token: string | null;
  children: React.ReactNode;
}) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (integration.avatarUrl && token) {
      resolveAvatarUrl(integration.avatarUrl, token).then((url) => {
        if (!cancelled) setAvatarSrc(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [integration.avatarUrl, token]);

  return (
    <div className="flex items-start gap-4">
      <Avatar src={avatarSrc} name={integration.name} />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold">{integration.name}</h1>
        {integration.description && (
          <p className="mt-1 max-w-2xl text-sm text-black/60">
            {integration.description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** One instance with its status, dates, and lifecycle actions. */
function InstanceRow({ instance }: { instance: InstanceSummary }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const status = instanceDisplayStatus(instance);
  const update = instanceUpdateAvailability(instance);

  function invalidateLists() {
    void queryClient.invalidateQueries({ queryKey: prismaticKeys.instances() });
    void queryClient.invalidateQueries({
      queryKey: prismaticKeys.marketplace(),
    });
  }

  const toggleMutation = useMutation({
    mutationFn: () => setInstanceEnabled(instance.id, !instance.enabled),
    onSuccess: invalidateLists,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInstance(instance.id),
    onSuccess: invalidateLists,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateInstanceVersion(instance.id, update.targetIntegrationId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: prismaticKeys.instances(),
      });
      await queryClient.invalidateQueries({
        queryKey: prismaticKeys.instance(instance.id),
      });
      router.push(`/integrations/configure/${encodeURIComponent(instance.id)}`);
    },
  });

  const busy =
    toggleMutation.isPending ||
    deleteMutation.isPending ||
    updateMutation.isPending ||
    updateMutation.isSuccess;
  const mutationError =
    toggleMutation.error ?? deleteMutation.error ?? updateMutation.error;
  const deployed = Boolean(instance.lastDeployedAt);

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <InstanceStatusIcon status={status} />
            <span className="truncate font-medium">{instance.name}</span>
          </div>
          <p className="mt-0.5 text-xs text-black/50">
            Created {formatShortDate(instance.createdAt)} ·{" "}
            {instance.lastDeployedAt
              ? `Deployed ${formatShortDate(instance.lastDeployedAt)}`
              : "Never deployed"}{" "}
            · {status.label}
          </p>
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-black/60">
              Delete this instance?
            </span>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={busy}
              className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-black/60 hover:text-black disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            {update.available && (
              <button
                onClick={() => updateMutation.mutate()}
                disabled={busy}
                className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending || updateMutation.isSuccess
                  ? "Updating…"
                  : "Update available"}
              </button>
            )}
            <Link
              href={`/integrations/configure/${encodeURIComponent(instance.id)}`}
              className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5"
            >
              Configure
            </Link>
            {deployed && (
              <button
                onClick={() => toggleMutation.mutate()}
                disabled={busy}
                className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-50"
              >
                {toggleMutation.isPending
                  ? "Saving…"
                  : instance.enabled
                    ? "Pause"
                    : "Resume"}
              </button>
            )}
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {mutationError && (
        <p className="text-xs text-red-700">
          {mutationError instanceof Error
            ? mutationError.message
            : String(mutationError)}
        </p>
      )}
    </div>
  );
}
