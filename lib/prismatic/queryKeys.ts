// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand. The single source of truth for React Query
// cache keys. Reads (useQuery) and the mutations that invalidate them (e.g. a submit
// that should refresh page content) reference the SAME factory, so a key can never
// drift out of sync between where it's set and where it's busted.
// ─────────────────────────────────────────────────────────────────────────────

export const prismaticKeys = {
  /** The embedded JWT (one shared session for the whole app). */
  token: () => ["prismatic", "token"] as const,
  /** The marketplace integration list. */
  marketplace: () => ["prismatic", "marketplace"] as const,
  /** The configuration-wizard instance + its config pages. */
  instance: (instanceId: string) =>
    ["prismatic", "instance", instanceId] as const,
  /** One config page's computed content (picklist options, JSONFORM schema, values). */
  page: (instanceId: string, pageName: string) =>
    ["prismatic", "page", instanceId, pageName] as const,
  /** Live OAuth connection statuses for an instance (polled). */
  connectionStatuses: (instanceId: string, startedAt: string) =>
    ["prismatic", "connection-statuses", instanceId, startedAt] as const,
};
