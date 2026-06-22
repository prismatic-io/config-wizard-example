// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. Instance read + lifecycle write operations: hydrate the wizard,
// resolve/create an instance, deploy it, disconnect a connection, move versions,
// and pause/resume. Each call goes through `graphql` and surfaces both
// transport errors and the mutation's own `errors` array.
// ─────────────────────────────────────────────────────────────────────────────

import type { MarketplaceIntegration } from "@/lib/marketplace";
import { graphql, throwIfApiError } from "./client";
import {
  CREATE_INSTANCE,
  DEPLOY_INSTANCE,
  DISCONNECT_CONNECTION,
  GET_CONFIGURATION_WIZARD_INSTANCE,
  SET_INSTANCE_ENABLED,
  UPDATE_INSTANCE_VERSION,
} from "./queries";
import type { ConfigWizardData, Node } from "./types";

/**
 * Runs the same query Prismatic's built-in wizard uses, scoped to the embedded
 * customer via the active JWT. Throws on GraphQL errors.
 */
export async function fetchConfigurationWizardInstance(
  instanceId: string,
): Promise<ConfigWizardData> {
  const result = await graphql<ConfigWizardData>({
    query: GET_CONFIGURATION_WIZARD_INSTANCE,
    variables: {
      instanceId,
      isUserLevelConfiguration: false,
      shouldGetAllAvailableVersions: true,
      shouldGetEmbeddedVersions: true,
      hasInitialPage: true,
    },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return result.data;
}

/**
 * Resolves an instanceId for a marketplace integration. Prefers the already-known
 * `firstDeployedInstance`; otherwise queries the customer's instances for this
 * integration (scoped to the customer by the JWT). Returns null when the customer
 * has no instance yet — instance creation is a future step.
 */
export async function resolveInstanceId(
  integration: Pick<MarketplaceIntegration, "id" | "firstDeployedInstance">,
): Promise<string | null> {
  if (integration.firstDeployedInstance?.id) {
    return integration.firstDeployedInstance.id;
  }

  const result = await graphql<{
    instances: Node<{ id: string }>;
  }>({
    query: /* GraphQL */ `
      query getInstanceForIntegration($integrationId: ID!) {
        instances(integration: $integrationId) {
          nodes {
            id
          }
        }
      }
    `,
    variables: { integrationId: integration.id },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return result.data.instances.nodes[0]?.id ?? null;
}

/**
 * Returns the id of the customer the active JWT is scoped to. Throws if the token
 * isn't customer-scoped (e.g. an org-level token), since instance creation needs a
 * customer to own the instance.
 */
export async function fetchCurrentCustomerId(): Promise<string> {
  const result = await graphql<{
    authenticatedUser: { customer: { id: string } | null } | null;
  }>({
    query: /* GraphQL */ `
      query getCurrentCustomer {
        authenticatedUser {
          customer {
            id
          }
        }
      }
    `,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  const id = result.data.authenticatedUser?.customer?.id;
  if (!id) {
    throw new Error("No customer is in scope for this session.");
  }
  return id;
}

interface CreateInstanceData {
  createInstance: {
    instance: { id: string } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/**
 * Creates an instance of a marketplace integration for the active customer, named
 * after the integration. Used when the customer has no instance yet (the "Connect"
 * action). The integration ID deploys its latest published version — no version id is
 * required. Returns the new instance id. Throws on errors.
 */
export async function createInstanceForIntegration(
  integration: Pick<MarketplaceIntegration, "id" | "name">,
): Promise<string> {
  const customer = await fetchCurrentCustomerId();
  const result = await graphql<CreateInstanceData>({
    query: CREATE_INSTANCE,
    variables: { integration: integration.id, customer, name: integration.name },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.createInstance.errors;
  if (errs?.length) {
    throw new Error(
      errs.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }
  const id = result.data.createInstance.instance?.id;
  if (!id) {
    throw new Error("Instance creation returned no id.");
  }
  return id;
}

interface DeployInstanceData {
  deployInstance: {
    instance: { id: string } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/** Deploys (activates) the instance with its current configuration. Throws on errors. */
export async function deployInstance(instanceId: string): Promise<void> {
  const result = await graphql<DeployInstanceData>({
    query: DEPLOY_INSTANCE,
    variables: { instanceId },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.deployInstance.errors;
  if (errs?.length) {
    throw new Error(
      errs.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }
}

interface DisconnectConnectionData {
  disconnectConnection: {
    instanceConfigVariable: { id: string; status: string | null } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/**
 * Disconnects an existing OAuth/connection config variable. `configVarId` is the
 * InstanceConfigVariable id (the `id` on each config var). On success the variable's
 * status flips to PENDING — re-fetch the page to surface a fresh authorize URL.
 * Throws on errors.
 */
export async function disconnectConnection(configVarId: string): Promise<void> {
  const result = await graphql<DisconnectConnectionData>({
    query: DISCONNECT_CONNECTION,
    variables: { id: configVarId },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.disconnectConnection.errors;
  if (errs?.length) {
    throw new Error(
      errs.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }
}

interface UpdateInstanceData {
  updateInstance: {
    instance: { id: string } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/**
 * Points an existing instance at a newer integration version (the AVAILABLE
 * marketplace version's integration id). `preserveDeployState: true` keeps the
 * instance enabled/paused state. After this, re-fetch the wizard so the customer can
 * configure any new/changed config pages. Throws on errors.
 */
export async function updateInstanceVersion(
  instanceId: string,
  integrationId: string,
): Promise<void> {
  const result = await graphql<UpdateInstanceData>({
    query: UPDATE_INSTANCE_VERSION,
    variables: { instanceId, integrationId },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.updateInstance.errors;
  if (errs?.length) {
    throw new Error(
      errs.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }
}

interface SetInstanceEnabledData {
  updateInstance: {
    instance: { id: string; enabled: boolean } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/**
 * Pauses (`enabled: false`) or resumes (`enabled: true`) a deployed instance,
 * keeping its configuration intact. Throws on errors.
 */
export async function setInstanceEnabled(
  instanceId: string,
  enabled: boolean,
): Promise<void> {
  const result = await graphql<SetInstanceEnabledData>({
    query: SET_INSTANCE_ENABLED,
    variables: { instanceId, enabled },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.updateInstance.errors;
  if (errs?.length) {
    throw new Error(
      errs.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }
}
