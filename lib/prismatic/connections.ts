// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. The poll side of OAuth: read every config variable's live `status`
// so the wizard can watch a connection flip to "ACTIVE" after the user authorizes
// in a separate tab. (The React polling loop lives in hooks/useConnectionStatus.ts.)
// ─────────────────────────────────────────────────────────────────────────────

import { graphql, throwIfApiError } from "./client";
import { GET_OAUTH2_CONNECTION_STATUSES } from "./queries";
import type { Node } from "./types";

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
