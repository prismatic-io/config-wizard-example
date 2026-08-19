/**
 * Mock FakeCRM data. There is no real FakeCRM API behind this integration —
 * these records back the config wizard's "Mapping Owner", "Link Deals", and
 * confirmation steps.
 *
 * The shapes mirror a typical CRM API: deals are fetched once per account
 * (account-scoped, never per person), and ownership is a field on each deal.
 * Team-owned deals are owned by a single account-level owner id, exactly like
 * production CRMs model shared pipelines.
 */

export interface CrmContact {
  id: string;
  name: string;
  /** Identity fields as a real CRM would return them. Team entries have
   * no first/last name. */
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface CrmDealOwner {
  ownerId: string;
  percentage: number;
}

export interface CrmDeal {
  key: string;
  name: string;
  type: string;
  value: number;
  owners: CrmDealOwner[];
}

export const CRM_CONTACTS: CrmContact[] = [
  {
    id: "CRM-1001",
    name: "Ava Reyes",
    firstName: "Ava",
    lastName: "Reyes",
    email: "ava.reyes@globex.example.com",
  },
  {
    id: "CRM-1002",
    name: "Globex Account Team (Shared)",
    email: "account-team@globex.example.com",
  },
  {
    id: "CRM-1003",
    name: "Noah Patel",
    firstName: "Noah",
    lastName: "Patel",
    email: "noah.patel@globex.example.com",
  },
  {
    id: "CRM-1004",
    name: "Globex Renewals Team",
    email: "renewals@globex.example.com",
  },
  {
    id: "CRM-1005",
    name: "Globex Support Team",
    email: "support@globex.example.com",
  },
];

/**
 * Account-level shared owner sentinel. FakeCRM attributes team-owned deals
 * to one account id (the demo's contacts all belong to the Globex account,
 * CRM-AC-1); for mapping purposes the account "belongs to" the shared
 * account-team contact entry (CRM-1002).
 */
export const CRM_ACCOUNT_TEAM = {
  id: "CRM-AC-1",
  label: "Shared Ownership (Account Team)",
  contactId: "CRM-1002",
};

export const CRM_DEALS: CrmDeal[] = [
  {
    key: "support_renewal",
    name: "Support Contract Renewal",
    type: "renewal",
    value: 33000,
    owners: [{ ownerId: "CRM-1005", percentage: 1 }],
  },
  {
    key: "platform_expansion",
    name: "Platform Expansion",
    type: "expansion",
    value: 1250000,
    owners: [{ ownerId: "CRM-1003", percentage: 1 }],
  },
  {
    key: "analytics_addon",
    name: "Analytics Add-on",
    type: "expansion",
    value: 145000,
    owners: [{ ownerId: "CRM-1003", percentage: 1 }],
  },
  {
    key: "premium_support",
    name: "Premium Support Plan",
    type: "services",
    value: 36000,
    owners: [{ ownerId: "CRM-1003", percentage: 1 }],
  },
  {
    key: "license_renewal",
    name: "Annual License Renewal",
    type: "renewal",
    value: 500000,
    owners: [{ ownerId: CRM_ACCOUNT_TEAM.id, percentage: 1 }],
  },
  {
    key: "enterprise_renewal",
    name: "Enterprise Platform Renewal",
    type: "renewal",
    value: 756000,
    owners: [{ ownerId: CRM_ACCOUNT_TEAM.id, percentage: 1 }],
  },
  {
    key: "onboarding_services",
    name: "Onboarding Services",
    type: "services",
    value: 100000,
    owners: [{ ownerId: CRM_ACCOUNT_TEAM.id, percentage: 1 }],
  },
];

/**
 * Simulates the single account-scoped fetch the real integration performs:
 * GET /v1/accounts/{accountId}/deals
 */
export const getDeals = (): CrmDeal[] => CRM_DEALS;

/** Owner column text, derived from the deal's ownership (as in prod). */
export const dealOwnerLabel = (deal: CrmDeal): string => {
  const names = deal.owners.map((o) => {
    if (o.ownerId === CRM_ACCOUNT_TEAM.id) {
      return CRM_ACCOUNT_TEAM.label;
    }
    return (
      CRM_CONTACTS.find((c) => c.id === o.ownerId)?.name ?? o.ownerId
    );
  });
  return names.join(", ");
};

export const formatUsd = (amount: number): string =>
  `$${amount.toLocaleString("en-US")}`;
