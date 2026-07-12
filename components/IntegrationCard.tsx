"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import {
  instanceDisplayStatus,
  resolveAvatarUrl,
  type MarketplaceIntegration,
} from "@/lib/marketplace";
import {
  createInstanceForIntegration,
  prismaticKeys,
  type InstanceSummary,
} from "@/lib/prismatic";
import { formatShortDate } from "@/lib/format";
import { InstanceStatusIcon } from "@/components/InstanceStatusIcon";
import { NewInstanceDialog } from "@/components/NewInstanceDialog";

/** How many instance rows the card previews before deferring to "View All". */
const MAX_ROWS = 3;

interface IntegrationCardProps {
  integration: MarketplaceIntegration;
  /** This customer's instances of this integration (may be empty). */
  instances: InstanceSummary[];
  /** Embedded JWT, used to resolve the avatar presigned URL. */
  token: string | null;
}

export function IntegrationCard({
  integration,
  instances,
  token,
}: IntegrationCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const multiAllowed = integration.allowMultipleMarketplaceInstances;
  const count = instances.length;
  // Newest first, like the marketplace mock; the fetch sorts oldest-first.
  const preview = [...instances].reverse().slice(0, MAX_ROWS);

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

  /**
   * One-click "Connect" for single-instance integrations: create the instance
   * with the default name and go straight to its config wizard.
   */
  const connectMutation = useMutation({
    mutationFn: () => createInstanceForIntegration(integration),
    onSuccess: async (instanceId) => {
      await queryClient.invalidateQueries({
        queryKey: prismaticKeys.instances(),
      });
      await queryClient.invalidateQueries({
        queryKey: prismaticKeys.marketplace(),
      });
      router.push(`/integrations/configure/${encodeURIComponent(instanceId)}`);
    },
  });
  const connecting = connectMutation.isPending || connectMutation.isSuccess;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <Avatar src={avatarSrc} name={integration.name} />
        {multiAllowed ? (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Add Integration
            <Plus size={14} />
          </button>
        ) : (
          count === 0 && (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connecting}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          )
        )}
      </div>

      <div className="min-w-0">
        <h3 className="truncate font-medium">
          {integration.name}
          {multiAllowed && count > 0 && (
            <span className="ml-1.5 font-normal text-black/50 dark:text-white/50">
              ({count})
            </span>
          )}
        </h3>
        {integration.category && (
          <p className="text-xs text-black/50 dark:text-white/50">
            {integration.category}
          </p>
        )}
      </div>

      {integration.description && (
        <p className="line-clamp-2 text-sm text-black/60 dark:text-white/60">
          {integration.description}
        </p>
      )}

      {connectMutation.error && (
        <p className="text-xs text-red-700 dark:text-red-400">
          {connectMutation.error instanceof Error
            ? connectMutation.error.message
            : String(connectMutation.error)}
        </p>
      )}

      <div className="mt-auto border-t border-black/10 pt-3 dark:border-white/15">
        {count === 0 ? (
          <p className="text-sm text-black/40 dark:text-white/40">
            No instances created
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {preview.map((instance) => (
              <Link
                key={instance.id}
                href={`/integrations/configure/${encodeURIComponent(instance.id)}`}
                className="flex items-center gap-3 rounded-md px-1 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="min-w-0 flex-1 truncate">{instance.name}</span>
                <span className="shrink-0 text-black/50 dark:text-white/50">
                  {formatShortDate(instance.lastDeployedAt ?? instance.createdAt)}
                </span>
                <InstanceStatusIcon status={instanceDisplayStatus(instance)} />
              </Link>
            ))}
            <Link
              href={`/integrations/${encodeURIComponent(integration.id)}`}
              className="mt-1 flex items-center justify-end gap-1 text-sm font-medium hover:underline"
            >
              View All
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      {adding && (
        <NewInstanceDialog
          integration={integration}
          existingCount={count}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

export function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset
      <img
        src={src}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/5 text-sm font-semibold dark:bg-white/10">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
