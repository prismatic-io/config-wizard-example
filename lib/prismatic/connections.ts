// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. The poll side of OAuth: read every config variable's live `status`
// so the wizard can watch a connection flip to "ACTIVE" after the user authorizes
// in a separate tab. (The React polling loop lives in hooks/useConnectionStatus.ts.)
// ─────────────────────────────────────────────────────────────────────────────

import { graphql, throwIfApiError } from "./client";
import { GET_OAUTH2_CONNECTION_STATUSES } from "./queries";
import type {
  ConnectionInputDescriptor,
  Node,
  PageConfigVariable,
  WizardConnection,
} from "./types";

interface ConnectionStatusNode {
  id: string;
  status: string | null;
  requiredConfigVariable: { id: string; key: string; stableId: string } | null;
}

interface ConnectionStatusesData {
  instance: {
    id: string;
    configVariables: Node<ConnectionStatusNode>;
    userLevelConfigVariables: Node<ConnectionStatusNode>;
  } | null;
}

/**
 * Fetches current `status` for every (instance- and user-level) config variable,
 * normalized into a map keyed by `requiredConfigVariable.key` — the same key the
 * wizard uses to look config vars up. Throws on GraphQL errors.
 */
export async function fetchOauth2ConnectionStatuses(
  instanceId: string,
  startedAt: string,
): Promise<Record<string, string | null>> {
  const result = await graphql<ConnectionStatusesData>({
    query: GET_OAUTH2_CONNECTION_STATUSES,
    variables: { resourceId: instanceId, startedAt },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);

  const statuses: Record<string, string | null> = {};
  const instance = result.data?.instance;
  for (const node of [
    ...(instance?.configVariables.nodes ?? []),
    ...(instance?.userLevelConfigVariables.nodes ?? []),
  ]) {
    const key = node.requiredConfigVariable?.key;
    if (key) statuses[key] = node.status;
  }
  return statuses;
}

/**
 * Whether a CONNECTION config var is key-based (api key / basic auth) rather than
 * OAuth2 — key-based connections have no authorize flow; the customer types the
 * input values instead. Falls back to the page-level signals (no authorize URL but
 * visible inputs) when integration metadata isn't available.
 */
export function isKeyBasedConnection(
  conn: WizardConnection | null | undefined,
  cv: PageConfigVariable,
): boolean {
  if (conn) return conn.oauth2Type == null;
  return cv.authorizeUrl == null && cv.inputs.nodes.length > 0;
}

/**
 * Joins a connection var's page-level input values to the integration-level input
 * metadata (label/type/required/comments/…) by `InputField.key` ↔
 * `ExpressionInput.name`. The page-level inputs are authoritative for which fields
 * the customer may edit (org-scoped inputs never appear there).
 */
export function joinConnectionInputs(
  conn: WizardConnection | null | undefined,
  cv: PageConfigVariable,
): ConnectionInputDescriptor[] {
  return cv.inputs.nodes.map((expr) => {
    const meta = conn?.inputs.nodes.find((f) => f.key === expr.name);
    return {
      name: expr.name,
      label: meta?.label || expr.name,
      // The API returns the type as an uppercase enum (STRING, PASSWORD, …);
      // normalize so renderers can compare against lowercase names.
      type: (meta?.type ?? "string").toLowerCase(),
      required: meta?.required ?? false,
      comments: meta?.comments ?? null,
      example: meta?.example ?? null,
      placeholder: meta?.placeholder ?? null,
      serverValue: expr.value,
      hasValue: expr.hasValue ?? false,
    };
  });
}

/**
 * Parses a key-based connection's draft (a JSON object of input name → typed
 * value, stored as one string in the wizard's draft map). Empty/corrupt drafts
 * parse to `{}` so the UI falls back to server values.
 */
export function parseConnectionDraft(
  draft: string | undefined,
): Record<string, string> {
  if (!draft) return {};
  try {
    const parsed = JSON.parse(draft);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}
