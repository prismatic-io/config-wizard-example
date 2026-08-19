/**
 * FakeCRM Owner Sync
 *
 * Syncs Acme owners to their mapped FakeCRM contacts. Both sides are mocked
 * (see acmeClient.ts and mockData.ts) — a "push" is a log line — but the
 * flow shape mirrors a real integration: register an Acme webhook on
 * deploy, full-sync the mapped owners, then re-sync on every owner event.
 */

import { flow } from "@prismatic-io/spectral";
import { getSyncableMappings } from "./ownerMapping";
import { AcmeClient, type AcmeOwnerData } from "./acmeClient";

interface AcmeWebhookPayload {
  event: "created" | "updated" | "deleted";
  resource_type: string;
  resource: {
    id: number;
    type: string;
    data: AcmeOwnerData;
    created_at: string;
    updated_at: string;
  };
  timestamp: string;
}

const isSynced = (owner: AcmeOwnerData, crmId: string): boolean =>
  owner.crm_id === crmId && owner.sync_status === "synced";

const syncOwner = async (
  client: AcmeClient,
  logger: { info: (msg: string) => void },
  ownerId: string | number,
  ownerName: string,
  crmId: string,
): Promise<void> => {
  await client.resources<AcmeOwnerData>("owner").update(ownerId, {
    crm_id: crmId,
    sync_status: "synced",
  });
  // Mock FakeCRM push — there is no real FakeCRM API behind this demo.
  logger.info(
    `[FakeCRM] PUT /v1/contacts/${crmId} — synced Acme owner "${ownerName}" (#${ownerId})`,
  );
};

export const syncOwnersToFakeCrm = flow({
  name: "Sync Owners to FakeCRM",
  stableKey: "sync-owners-to-fakecrm",
  description:
    "Syncs mapped Acme owners to their FakeCRM contacts on activation and whenever an owner changes",

  onTrigger: async (context, payload) => {
    context.logger.info("Received owner event from Acme");
    return Promise.resolve({ payload });
  },

  onInstanceDeploy: async (context) => {
    const { logger, configVars, webhookUrls, instance, customer, integration } =
      context;

    const client = new AcmeClient({ logger });

    const webhookUrl = webhookUrls[context.flow.name];
    if (!webhookUrl) {
      throw new Error("Webhook URL not found in context");
    }

    logger.info(`Registering Acme webhook with URL: ${webhookUrl}`);
    const result = await client.webhook.register({
      url: webhookUrl,
      events: ["created", "updated"],
      resource_types: ["owner"],
      metadata: {
        prismatic: {
          instanceId: instance.id,
          customerId: customer.id,
          flowName: context.flow?.name || "unknown",
          integrationName: integration.name,
        },
      },
    });
    logger.info(`Acme webhook registered with ID: ${result.id}`);

    // Initial full sync of every mapped owner. Never block the deploy on a
    // sync hiccup — the webhook-triggered flow catches up later.
    try {
      const mappings = getSyncableMappings(configVars["Owner Mapping"]);
      const owners = await client.resources<AcmeOwnerData>("owner").list();
      let synced = 0;
      for (const row of mappings) {
        const owner = owners.find((o) => String(o.id) === row.acmeOwner);
        if (!owner || isSynced(owner.data, row.crmContact)) {
          continue;
        }
        await syncOwner(
          client,
          logger,
          owner.id,
          String(owner.data.name ?? owner.id),
          row.crmContact,
        );
        synced += 1;
      }
      logger.info(
        `Initial sync complete: ${synced} of ${mappings.length} mapped owners updated`,
      );
    } catch (error) {
      logger.error(`Initial owner sync failed (continuing deploy): ${error}`);
    }

    // Note: instanceState is NOT writable in onInstanceDeploy — use crossFlowState
    return {
      crossFlowState: {
        acmeWebhookId: result.id,
      },
    };
  },

  onInstanceDelete: async (context) => {
    const { logger, crossFlowState } = context;

    const webhookId = crossFlowState?.acmeWebhookId as number;
    if (!webhookId) {
      logger.warn("No Acme webhook ID found in state; skipping deletion");
      return;
    }

    const client = new AcmeClient({ logger });
    logger.info(`Deleting Acme webhook with ID: ${webhookId}`);
    await client.webhook.delete(webhookId);
    logger.info(`Acme webhook ${webhookId} deleted successfully`);
  },

  onExecution: async (context, params) => {
    const { logger, configVars } = context;

    const payload = params.onTrigger.results;
    const webhookData = payload.body?.data as unknown as AcmeWebhookPayload;
    if (!webhookData?.resource) {
      logger.error("No webhook data received");
      return { data: { error: "No webhook data" } };
    }

    if (webhookData.event === "deleted") {
      return { data: { skipped: true, reason: "Owner deleted" } };
    }

    const ownerId = String(webhookData.resource.id);
    const ownerData = webhookData.resource.data;

    const mappings = getSyncableMappings(configVars["Owner Mapping"]);
    const row = mappings.find((m) => m.acmeOwner === ownerId);
    if (!row) {
      logger.info(`Owner #${ownerId} is not mapped to a FakeCRM contact`);
      return { data: { skipped: true, reason: "Owner not mapped" } };
    }

    // Idempotency guard: our own update below re-fires this webhook. If the
    // owner already carries the mapped FakeCRM id and is synced, stop here —
    // without this the flow loops forever.
    if (isSynced(ownerData, row.crmContact)) {
      logger.info(`Owner #${ownerId} already synced to ${row.crmContact}`);
      return { data: { skipped: true, reason: "Already synced" } };
    }

    const client = new AcmeClient({ logger });
    await syncOwner(
      client,
      logger,
      ownerId,
      String(ownerData.name ?? ownerId),
      row.crmContact,
    );

    return {
      data: {
        success: true,
        ownerId,
        crmContactId: row.crmContact,
      },
    };
  },
});

export default [syncOwnersToFakeCrm];
