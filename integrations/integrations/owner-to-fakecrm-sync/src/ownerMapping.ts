/**
 * Shared parsing of the "Owner Mapping" jsonForm config var, used by both
 * the config wizard performs and the sync flow.
 *
 * The value is `unknown` at runtime and may arrive as an object or a JSON
 * string — parse defensively (headless/migration writes carry the same
 * requirement in production integrations).
 */

import { type CrmDeal, CRM_ACCOUNT_TEAM } from "./mockData";

export interface OwnerMappingRow {
  crmContact: string;
  acmeOwner: string;
}

/** All complete rows, including "create:*" sentinel selections. */
const parseRows = (raw: unknown): OwnerMappingRow[] => {
  if (raw == null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  const mappings = (parsed as { mappings?: OwnerMappingRow[] })?.mappings;
  if (!Array.isArray(mappings)) {
    return [];
  }
  return mappings.filter((row) => row?.crmContact && row?.acmeOwner);
};

/**
 * Rows the sync flow acts on: mapped to an existing Acme owner. Rows
 * whose acmeOwner is a "create:*" sentinel (the "+ Create ..." picklist
 * options) are config-wizard-only and excluded here.
 */
export const getSyncableMappings = (raw: unknown): OwnerMappingRow[] =>
  parseRows(raw).filter((row) => !row.acmeOwner.startsWith("create:"));

/**
 * FakeCRM contact ids that count as mapped for deal visibility. A "create:*"
 * selection still counts — the owner will exist in Acme.
 */
export const getMappedCrmIds = (raw: unknown): Set<string> =>
  new Set(parseRows(raw).map((row) => row.crmContact));

/**
 * A deal is visible when every owner on it is mapped. The account-team
 * owner resolves through its shared contact entry (CRM-1002).
 */
export const isDealMapped = (
  deal: CrmDeal,
  mappedIds: Set<string>,
): boolean =>
  deal.owners.every((o) =>
    o.ownerId === CRM_ACCOUNT_TEAM.id
      ? mappedIds.has(CRM_ACCOUNT_TEAM.contactId)
      : mappedIds.has(o.ownerId),
  );
