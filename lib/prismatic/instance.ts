// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. Instance read + lifecycle write operations: hydrate the wizard,
// list the customer's instances, create/delete an instance, deploy it, disconnect
// a connection, move versions, and pause/resume. Each call goes through `graphql`
// and surfaces both transport errors and the mutation's own `errors` array.
// ─────────────────────────────────────────────────────────────────────────────

import type { MarketplaceIntegration } from "@/lib/marketplace";
import { graphql, throwIfApiError } from "./client";
import {
  CREATE_INSTANCE,
  DELETE_INSTANCE,
  DEPLOY_INSTANCE,
  DISCONNECT_CONNECTION,
  GET_CONFIGURATION_WIZARD_INSTANCE,
  GET_CUSTOMER_INSTANCES,
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

/** How far an instance's configuration has progressed. */
export type InstanceConfigState =
  | "NEEDS_INSTANCE_CONFIGURATION"
  | "NEEDS_USER_LEVEL_CONFIGURATION"
  | "FULLY_CONFIGURED";

/**
 * One of the customer's instances, as returned by `getCustomerInstances` — the
 * fields the marketplace UI needs to list, match, and act on instances.
 */
export interface InstanceSummary {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  /** Null until the instance has been deployed at least once. */
  lastDeployedAt: string | null;
  configState: InstanceConfigState;
  isCustomerUpgradeable: boolean;
  integration: {
    id: string;
    versionNumber: number;
    /** Stable across all versions of an integration — the key for matching an
     * instance to its marketplace integration. */
    versionSequenceId: string;
    /** Latest AVAILABLE marketplace version (first node), if any. */
    versionSequence: { nodes: { id: string; versionNumber: number }[] };
  };
}

/**
 * Fetches every instance the active customer owns (the JWT scopes the query),
 * oldest first. The marketplace groups these per integration via
 * `versionSequenceId`. Throws on errors.
 */
export async function fetchCustomerInstances(): Promise<InstanceSummary[]> {
  const result = await graphql<{ instances: Node<InstanceSummary> }>({
    query: GET_CUSTOMER_INSTANCES,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return [...result.data.instances.nodes].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
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
 * Creates an instance of a marketplace integration for the active customer —
 * named `name` when given (the "Add Integration" dialog), else after the
 * integration (the one-click "Connect" action). The integration ID deploys its
 * latest published version — no version id is required. Returns the new instance
 * id. Throws on errors.
 */
export async function createInstanceForIntegration(
  integration: Pick<MarketplaceIntegration, "id" | "name">,
  name?: string,
): Promise<string> {
  const customer = await fetchCurrentCustomerId();
  const result = await graphql<CreateInstanceData>({
    query: CREATE_INSTANCE,
    variables: {
      integration: integration.id,
      customer,
      name: name?.trim() || integration.name,
    },
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

interface DeleteInstanceData {
  deleteInstance: {
    instance: { id: string } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/**
 * Permanently deletes an instance (its configuration included). Throws on errors.
 */
export async function deleteInstance(instanceId: string): Promise<void> {
  const result = await graphql<DeleteInstanceData>({
    query: DELETE_INSTANCE,
    variables: { instanceId },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.deleteInstance.errors;
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
