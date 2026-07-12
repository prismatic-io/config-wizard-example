import prismatic from "@prismatic-io/embedded";
import type { InstanceSummary } from "@/lib/prismatic/instance";

/** A marketplace integration as returned by the `marketplaceIntegrations` query. */
export interface MarketplaceIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  avatarUrl?: string | null;
  allowMultipleMarketplaceInstances: boolean;
  /** Stable across all versions of this integration — the key that matches the
   * customer's instances (see `groupInstancesByIntegration`). */
  versionSequenceId: string;
}

interface MarketplaceIntegrationsData {
  marketplaceIntegrations: { nodes: MarketplaceIntegration[] };
}

const GET_MARKETPLACE_INTEGRATIONS = /* GraphQL */ `
  query getMarketplaceIntegrations {
    marketplaceIntegrations(includeActiveIntegrations: true) {
      nodes {
        id
        name
        description
        category
        avatarUrl
        allowMultipleMarketplaceInstances
        versionSequenceId
      }
    }
  }
`;

/**
 * Fetches the customer's marketplace integrations via the embedded SDK. The
 * request is authorized automatically with the JWT from the last authenticate()
 * call, so this only works once the SDK is authenticated.
 */
export async function fetchMarketplaceIntegrations(): Promise<
  MarketplaceIntegration[]
> {
  const result = await prismatic.graphqlRequest<MarketplaceIntegrationsData>({
    query: GET_MARKETPLACE_INTEGRATIONS,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }

  return result.data.marketplaceIntegrations.nodes;
}

/** Base URL of the Prismatic app; mirrors the embedded SDK's default. */
const PRISMATIC_URL =
  process.env.NEXT_PUBLIC_PRISMATIC_URL ?? "https://app.prismatic.io";

/**
 * Integration avatars live in authenticated S3 — `avatarUrl` can't be used as an
 * <img src> directly. The query returns a relative `/media/...` path; fetching it
 * (absolute, with the JWT) returns `{ url }` pointing at a short-lived presigned
 * S3 URL. Returns null on any failure so the UI can fall back to initials.
 */
export async function resolveAvatarUrl(
  avatarUrl: string,
  token: string,
): Promise<string | null> {
  try {
    const absolute = avatarUrl.startsWith("http")
      ? avatarUrl
      : `${PRISMATIC_URL}${avatarUrl}`;
    const res = await fetch(absolute, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string; data?: { url?: string } };
    return json.url ?? json.data?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Groups the customer's instances by marketplace integration id. An instance
 * points at the integration *version* it was deployed from, so its
 * `integration.id` won't match a marketplace node that has since published a
 * newer version — `versionSequenceId` is the identity that survives versioning,
 * so instances are matched on that.
 */
export function groupInstancesByIntegration(
  integrations: MarketplaceIntegration[],
  instances: InstanceSummary[],
): Map<string, InstanceSummary[]> {
  const bySequence = new Map<string, InstanceSummary[]>();
  for (const instance of instances) {
    const key = instance.integration.versionSequenceId;
    const group = bySequence.get(key);
    if (group) {
      group.push(instance);
    } else {
      bySequence.set(key, [instance]);
    }
  }
  return new Map(
    integrations.map((integration) => [
      integration.id,
      bySequence.get(integration.versionSequenceId) ?? [],
    ]),
  );
}

export interface InstanceDisplayStatus {
  label: "Active" | "Paused" | "Unconfigured";
  tone: "active" | "paused" | "unconfigured";
}

/**
 * Derives one of three visual states for an instance: it's **unconfigured**
 * until it has been fully configured and deployed at least once, then **active**
 * or **paused** by its `enabled` flag.
 */
export function instanceDisplayStatus(
  instance: InstanceSummary,
): InstanceDisplayStatus {
  if (!instance.lastDeployedAt || instance.configState !== "FULLY_CONFIGURED") {
    return { label: "Unconfigured", tone: "unconfigured" };
  }
  return instance.enabled
    ? { label: "Active", tone: "active" }
    : { label: "Paused", tone: "paused" };
}

/**
 * Whether an instance can be moved to a newer marketplace version. An update is
 * offered only when the instance is customer-upgradeable AND a published
 * AVAILABLE version exists with a higher version number than the deployed one.
 * `targetIntegrationId` is the integration id of that newer version — pass it to
 * `updateInstanceVersion`.
 */
export function instanceUpdateAvailability(instance: InstanceSummary): {
  available: boolean;
  targetIntegrationId: string | null;
} {
  const latest = instance.integration.versionSequence.nodes[0];
  const available = Boolean(
    instance.isCustomerUpgradeable &&
      latest &&
      latest.versionNumber > instance.integration.versionNumber,
  );
  return {
    available,
    targetIntegrationId: available ? latest!.id : null,
  };
}

/**
 * Default name for a new instance: the integration's name for the first one,
 * then "Name 2", "Name 3", … Pre-fills the "Add Integration" dialog; names can
 * still collide after deletes, in which case the API's duplicate-name error
 * surfaces and the customer edits.
 */
export function defaultInstanceName(
  integration: Pick<MarketplaceIntegration, "name">,
  existingCount: number,
): string {
  return existingCount === 0
    ? integration.name
    : `${integration.name} ${existingCount + 1}`;
}
