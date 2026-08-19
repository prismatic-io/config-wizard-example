/**
 * Mock Acme client. Like the FakeCRM side (mockData.ts), the Acme side of
 * this demo is static data — there is no Acme app API behind it, so the
 * integration spins up with zero external services and zero credentials.
 *
 * The surface mirrors the real client a production integration would use:
 * `resources("owner")` CRUD plus webhook registration. Reads serve the static
 * owner list below; writes and webhook calls just log and succeed.
 */

export interface AcmeOwnerData {
  name: string;
  owner_type?: string;
  company?: string;
  email?: string;
  crm_id?: string;
  sync_status?: string;
}

/** The wrapper shape the real API returns records in. */
export interface AcmeRecord<T = Record<string, unknown>> {
  id: number;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface AcmeWebhookRegistration {
  url: string;
  events?: string[];
  resource_types: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Static Acme owners. Names deliberately overlap the FakeCRM contacts in
 * mockData.ts so the Owner Mapping page pre-matches most rows by name —
 * the shared account-team entry stays unmatched on purpose, so the demo shows
 * both the pre-filled and the map-it-yourself (or "+ Create …") experience.
 */
const ACME_OWNERS: Array<AcmeRecord<AcmeOwnerData>> = [
  { id: 1, data: { name: "Ava Reyes", owner_type: "individual", company: "Globex" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  { id: 2, data: { name: "Noah Patel", owner_type: "individual", company: "Globex" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  { id: 3, data: { name: "Globex Renewals Team", owner_type: "team", company: "Globex" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  { id: 4, data: { name: "Globex Support Team", owner_type: "team", company: "Globex" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  { id: 5, data: { name: "Globex Holdings LLC", owner_type: "company", company: "Globex" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  { id: 6, data: { name: "Priya Sharma", owner_type: "individual", company: "Initech" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  { id: 7, data: { name: "Tunde Adebayo", owner_type: "individual", company: "Hooli" }, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
];

interface Logger {
  info: (msg: string) => void;
}

const noopLogger: Logger = { info: () => undefined };

export class AcmeClient {
  private logger: Logger;

  constructor({ logger }: { logger?: Logger } = {}) {
    this.logger = logger ?? noopLogger;
  }

  /** `resources("owner")` is the only type this mock knows. */
  public resources<T = AcmeOwnerData>(type: string) {
    return {
      list: async (): Promise<Array<AcmeRecord<T>>> => {
        this.logger.info(`[Acme mock] GET /api/resources?type=${type}`);
        return ACME_OWNERS as unknown as Array<AcmeRecord<T>>;
      },
      update: async (
        id: string | number,
        updates: Partial<T>,
      ): Promise<AcmeRecord<T>> => {
        this.logger.info(
          `[Acme mock] PUT /api/resources/${id} ${JSON.stringify(updates)}`,
        );
        const record = ACME_OWNERS.find((o) => String(o.id) === String(id));
        return {
          ...(record ?? { id: Number(id), data: {}, createdAt: "", updatedAt: "" }),
          data: { ...(record?.data ?? {}), ...updates },
        } as unknown as AcmeRecord<T>;
      },
    };
  }

  public readonly webhook = {
    register: async (
      payload: AcmeWebhookRegistration,
    ): Promise<{ success: boolean; id: number; message: string }> => {
      this.logger.info(`[Acme mock] POST /api/webhooks → ${payload.url}`);
      return { success: true, id: 4242, message: "mock webhook registered" };
    },
    delete: async (webhookId: number): Promise<void> => {
      this.logger.info(`[Acme mock] DELETE /api/webhooks/${webhookId}`);
    },
  };
}
