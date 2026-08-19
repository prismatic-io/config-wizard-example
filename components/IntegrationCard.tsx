"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
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

/** How many instance rows the card previews before deferring to "View all". */
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
  const linked = instances.some((i) => instanceDisplayStatus(i).tone === "active");
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
   * One-click "Link Account" for single-instance integrations: create the
   * instance with the default name and go straight to its config wizard.
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
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <Avatar src={avatarSrc} name={integration.name} />
        {multiAllowed || count === 0 ? (
          <button
            onClick={() => (multiAllowed ? setAdding(true) : connectMutation.mutate())}
            disabled={connecting}
            className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {connecting ? "Linking…" : "Link Account"}
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-2">
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
          {linked ? "Linked" : "Unlinked"}
        </span>
        <h3 className="truncate font-serif text-2xl text-neutral-900">
          {integration.name}
        </h3>
        <p className="text-sm text-neutral-500">
          {count} account{count === 1 ? "" : "s"} linked
        </p>
      </div>

      {connectMutation.error && (
        <p className="text-xs text-red-600">
          {connectMutation.error instanceof Error
            ? connectMutation.error.message
            : String(connectMutation.error)}
        </p>
      )}

      {count > 0 && (
        <div className="mt-auto border-t border-neutral-200 pt-3">
          <div className="flex flex-col gap-1">
            {preview.map((instance) => (
              <Link
                key={instance.id}
                href={`/integrations/configure/${encodeURIComponent(instance.id)}`}
                className="flex items-center gap-3 rounded-md px-1 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <span className="min-w-0 flex-1 truncate">{instance.name}</span>
                <span className="shrink-0 text-neutral-400">
                  {formatShortDate(instance.lastDeployedAt ?? instance.createdAt)}
                </span>
                <InstanceStatusIcon status={instanceDisplayStatus(instance)} />
              </Link>
            ))}
            <Link
              href={`/integrations/${encodeURIComponent(integration.id)}`}
              className="mt-1 flex items-center justify-end gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

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

/** Round brand mark: the integration's logo, or an ink circle with its lowercase serif initial. */
export function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset
      <img
        src={src}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 font-serif text-lg text-white">
      {name.charAt(0).toLowerCase()}
    </div>
  );
}
