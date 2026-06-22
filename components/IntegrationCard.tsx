"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  integrationStatus,
  resolveAvatarUrl,
  updateAvailability,
  type MarketplaceIntegration,
} from "@/lib/marketplace";
import {
  createInstanceForIntegration,
  resolveInstanceId,
  setInstanceEnabled,
  updateInstanceVersion,
} from "@/lib/prismatic";

const TONE_CLASSES = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  configured: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  inactive: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60",
} as const;

interface IntegrationCardProps {
  integration: MarketplaceIntegration;
  /** Embedded JWT, used to resolve the avatar presigned URL. */
  token: string | null;
  /** Called after a mutation (update/pause/resume) so the marketplace can refetch. */
  onMutated?: () => void;
}

export function IntegrationCard({
  integration,
  token,
  onMutated,
}: IntegrationCardProps) {
  const router = useRouter();
  const status = integrationStatus(integration);
  const isConfigured = integration.deployedInstances !== "ZERO";
  const instanceId = integration.firstDeployedInstance?.id ?? null;
  const { available: updateReady, targetIntegrationId } =
    updateAvailability(integration);
  const deploymentStatus = integration.deploymentStatus;
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
   * Open OUR custom config wizard. Resolve the instanceId for this integration, or
   * create an instance for the customer when none exists yet, then route to the
   * dedicated wizard page.
   */
  async function openConfigWizard() {
    setOpening(true);
    setNote(null);
    try {
      let instanceId = await resolveInstanceId(integration);
      if (!instanceId) {
        instanceId = await createInstanceForIntegration(integration);
      }
      router.push(`/integrations/configure/${encodeURIComponent(instanceId)}`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(false);
    }
  }

  /**
   * Move the deployed instance to the newer marketplace version, then open the
   * wizard so the customer can review/configure any new fields (config pages are
   * refetched fresh on the wizard page).
   */
  async function handleUpdate() {
    if (!instanceId || !targetIntegrationId) return;
    setOpening(true);
    setNote(null);
    try {
      await updateInstanceVersion(instanceId, targetIntegrationId);
      router.push(`/integrations/configure/${encodeURIComponent(instanceId)}`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
      setOpening(false);
    }
  }

  /** Pause (enabled: false) or resume (enabled: true) the deployed instance. */
  async function handleToggleEnabled(enabled: boolean) {
    if (!instanceId) return;
    setToggling(true);
    setNote(null);
    try {
      await setInstanceEnabled(instanceId, enabled);
      onMutated?.();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-start gap-3">
        <Avatar src={avatarSrc} name={integration.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{integration.name}</h3>
          {integration.category && (
            <p className="text-xs text-black/50 dark:text-white/50">
              {integration.category}
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[status.tone]}`}
        >
          {status.label}
        </span>
      </div>

      {integration.description && (
        <p className="line-clamp-2 text-sm text-black/60 dark:text-white/60">
          {integration.description}
        </p>
      )}

      {updateReady && (
        <button
          onClick={handleUpdate}
          disabled={opening || toggling}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {opening ? "Updating…" : "Update available"}
        </button>
      )}

      <button
        onClick={openConfigWizard}
        disabled={opening || toggling}
        className="mt-auto rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {opening ? "Opening…" : isConfigured ? "Manage" : "Connect"}
      </button>

      {deploymentStatus === "ACTIVATED" && (
        <button
          onClick={() => handleToggleEnabled(false)}
          disabled={opening || toggling}
          className="text-xs text-black/50 hover:text-black/80 disabled:opacity-50 dark:text-white/50 dark:hover:text-white/80"
        >
          {toggling ? "Disabling…" : "Disable integration"}
        </button>
      )}
      {deploymentStatus === "PAUSED" && (
        <button
          onClick={() => handleToggleEnabled(true)}
          disabled={opening || toggling}
          className="text-xs font-medium text-green-700 hover:text-green-800 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
        >
          {toggling ? "Enabling…" : "Enable integration"}
        </button>
      )}

      {note && (
        <p className="text-xs text-black/50 dark:text-white/50">{note}</p>
      )}
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset
    return (
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
