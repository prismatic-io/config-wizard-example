import { flow } from "@prismatic-io/spectral";
import { ACME_CATEGORIES, evaluateDeliveryRules, parseSelection } from "@acme/shared";
import { acmeEventWebhook } from "./manifests/acme/triggers/eventWebhook";
import { formatAcmeSlackMessage } from "./lib/postToSlack";

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
 * Acme posts every event to one webhook, each tagged with a `category` (deployments / security /
 * billing). This single flow routes by that category: it reads the category's saved delivery rules
 * from the holistic "Configuration" config var — `{ <categoryKey>: { enabled, delivery: { channels,
 * mode, minLevel, quietHours… } } }` — gates on `evaluateDeliveryRules` (minimum level + quiet hours),
 * and posts to the chosen `delivery.channels`.
 */
export const acmeEventToSlack = flow({
  name: "Acme Event → Slack",
  stableKey: "acme-event-to-slack",
  description:
    "Route Acme webhook events to Slack by category, honoring each category's delivery rules.",
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
    const message = formatAcmeSlackMessage({
      category: label,
      title: readField(body, "title") ?? `New ${label} event`,
      summary: readField(body, "summary") ?? `A new ${label} event was received.`,
      link: readField(body, "url"),
    });
    for (const channelName of delivery.channels ?? []) {
      await context.components.slack.postMessage({
        connection: context.configVars["Slack Connection"],
        channelName,
        message,
      });
    }
    return { data: null };
  },
});

export default [acmeEventToSlack];
