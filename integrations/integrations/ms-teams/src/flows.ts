import { flow } from "@prismatic-io/spectral";
import { ACME_CATEGORIES, evaluateDeliveryRules, parseSelection } from "@acme/shared";
import { acmeEventWebhook } from "./manifests/acme/triggers/eventWebhook";
import { formatAcmeTeamsMessage } from "./lib/postToTeams";

type WebhookBody = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

function readField(payload: WebhookBody, key: string): string | undefined {
  const direct = payload[key];
  if (typeof direct === "string") return direct;
  const nested = payload.data?.[key];
  return typeof nested === "string" ? nested : undefined;
}

/** Display label for a category key, falling back to the key itself for unknown categories. */
function categoryLabel(categoryKey: string): string {
  return (
    ACME_CATEGORIES.find((c) => c.category.key === categoryKey)?.category.label ??
    categoryKey
  );
}

/**
 * Acme posts every event to one webhook, each tagged with a `category`. This single flow routes by
 * that category, reading the category's saved delivery rules from the holistic "Configuration" config
 * var — the exact same shape the Slack integration writes, because both are built from the same shared
 * config-var library — and gating on `evaluateDeliveryRules` before "posting" (logged fake) to each
 * selected channel.
 */
export const acmeEventToTeams = flow({
  name: "Acme Event → Teams",
  stableKey: "acme-event-to-teams",
  description:
    "Route Acme webhook events to Microsoft Teams by category, honoring each category's delivery rules.",
  onTrigger: acmeEventWebhook({}),
  onExecution: async (context, params) => {
    const body = (params.onTrigger.results.body.data ?? {}) as WebhookBody;

    const categoryKey = readField(body, "category");
    if (!categoryKey) return { data: null };

    const selection = parseSelection(context.configVars["Configuration"]);
    const entry = selection[categoryKey];
    if (entry?.enabled !== true) return { data: null };

    const delivery = entry.delivery ?? {};
    if (
      !evaluateDeliveryRules(delivery, {
        level: readField(body, "level"),
        timestamp: readField(body, "timestamp"),
      })
    ) {
      return { data: null };
    }

    const label = categoryLabel(categoryKey);
    const message = formatAcmeTeamsMessage({
      category: label,
      title: readField(body, "title") ?? `New ${label} event`,
      summary: readField(body, "summary") ?? `A new ${label} event was received.`,
      link: readField(body, "url"),
    });
    // Faked Teams delivery: log the message per selected channel instead of calling a Teams component.
    for (const channelName of delivery.channels ?? []) {
      context.logger.info(`[MS Teams] → ${channelName}: ${message}`);
    }
    return { data: null };
  },
});

export default [acmeEventToTeams];
