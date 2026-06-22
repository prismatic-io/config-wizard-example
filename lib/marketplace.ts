import prismatic from "@prismatic-io/embedded";

interface IntegrationVersionNode {
  id: string;
  versionNumber: number;
}

/** The customer's deployed instance for an integration, with the info needed to
 * decide whether an update is available and whether it's currently enabled. */
export interface FirstDeployedInstance {
  id: string;
  enabled: boolean;
  isCustomerUpgradeable: boolean;
  integration: {
    id: string;
    versionNumber: number;
    /** Latest AVAILABLE marketplace version (first node), if any. */
    versionSequence: { nodes: IntegrationVersionNode[] };
  };
}

/** A marketplace integration as returned by the `marketplaceIntegrations` query. */
export interface MarketplaceIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  avatarUrl?: string | null;
  allowMultipleMarketplaceInstances: boolean;
  /** "ZERO" — not configured; "ONE" — one instance; "MULTIPLE" — several. */
  deployedInstances: "ZERO" | "ONE" | "MULTIPLE";
  /** Null when not deployed. */
  deploymentStatus: "ACTIVATED" | "PAUSED" | "UNCONFIGURED" | null;
  firstDeployedInstance?: FirstDeployedInstance | null;
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
        deployedInstances
        deploymentStatus
        firstDeployedInstance {
          id
          enabled
          isCustomerUpgradeable
          integration {
            id
            versionNumber
            versionSequence(
              first: 1
              marketplaceConfiguration_Istartswith: "AVAILABLE"
              orderBy: { direction: DESC, field: VERSION_NUMBER }
            ) {
              nodes {
                id
                versionNumber
              }
            }
          }
        }
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

/** Derives a human-readable status label + tone from the deployment fields. */
export function integrationStatus(integration: MarketplaceIntegration): {
  label: string;
  tone: "active" | "configured" | "inactive";
} {
  if (integration.deploymentStatus === "ACTIVATED") {
    return { label: "Active", tone: "active" };
  }
  if (integration.deploymentStatus === "PAUSED") {
    return { label: "Paused", tone: "inactive" };
  }
  if (integration.deployedInstances !== "ZERO") {
    return { label: "Configured", tone: "configured" };
  }
  return { label: "Not connected", tone: "inactive" };
}

/**
 * Whether the deployed instance can be moved to a newer marketplace version. An
 * update is offered only when the instance is customer-upgradeable AND a published
 * AVAILABLE version exists with a higher version number than the deployed one.
 * `targetIntegrationId` is the integration id of that newer version — pass it to
 * `updateInstanceVersion`.
 */
export function updateAvailability(integration: MarketplaceIntegration): {
  available: boolean;
  targetIntegrationId: string | null;
} {
  const deployed = integration.firstDeployedInstance;
  const latest = deployed?.integration.versionSequence.nodes[0];
  const available = Boolean(
    deployed?.isCustomerUpgradeable &&
      latest &&
      latest.versionNumber > deployed.integration.versionNumber,
  );
  return {
    available,
    targetIntegrationId: available ? latest!.id : null,
  };
}
